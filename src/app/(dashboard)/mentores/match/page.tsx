// GRUPO MENTORES — match proyecto–mentor. El agente sugiere; el coordinador decide.
import { Suspense } from "react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BotonEnviar } from "../_components/boton-enviar";
import { Estrellas } from "../_components/estrellas";
import { urlBase } from "../reuniones/agente";
import { sugerirMentores } from "./agente";
import { avisarAsignacion } from "./avisar";

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
// Cuánto tardaba el coordinador en encontrar un mentor a mano (dato del grupo).
const MINUTOS_A_MANO = 60;
const duracion = (min: number) =>
  min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}`;
const conError = (mensaje: string) => redirect(`/mentores/match?error=${encodeURIComponent(mensaje)}`);

async function pedirSugerencias(formData: FormData) {
  "use server";
  const coordinador = await requireRol();
  const proyectoId = String(formData.get("proyecto_id"));
  if (!process.env.AI_GATEWAY_API_KEY) conError("Falta la clave de IA (AI_GATEWAY_API_KEY) en .env.local. Pedísela al profe.");

  const supabase = await createClient();
  let resultado;
  try {
    resultado = await sugerirMentores(supabase, proyectoId);
  } catch (e) {
    console.error(e);
    conError("El agente no pudo armar sugerencias. Probá de nuevo en un rato.");
  }

  const { data: pedido, error } = await supabase
    .from("mentores_match_pedidos")
    .insert({ proyecto_id: proyectoId, pedido_por: coordinador.id, aviso: resultado!.aviso })
    .select("id")
    .single();
  if (error) throw error;
  if (resultado!.sugerencias.length) {
    const { error } = await supabase.from("mentores_sugerencias").insert(
      resultado!.sugerencias.map((s) => ({ ...s, pedido_id: pedido.id, proyecto_id: proyectoId })),
    );
    if (error) throw error;
  }
  revalidatePath("/mentores/match");
  redirect("/mentores/match");
}

async function decidir(formData: FormData) {
  "use server";
  const coordinador = await requireRol();
  const estado = String(formData.get("estado"));
  if (estado !== "aceptada" && estado !== "rechazada") conError("Decisión inválida");

  const supabase = await createClient();
  const id = String(formData.get("id"));
  const ahora = new Date();
  // Tiempo ahorrado: buscarlo a mano (60 min) menos lo que tardó desde que pidió sugerencias hasta aceptar.
  let minutos_ahorrados: number | null = null;
  if (estado === "aceptada") {
    const { data } = await supabase.from("mentores_sugerencias").select("pedido_id").eq("id", id).single();
    const { data: pedido } = await supabase.from("mentores_match_pedidos").select("created_at").eq("id", data?.pedido_id ?? "").single();
    const tardo = pedido ? (ahora.getTime() - Date.parse(pedido.created_at)) / 6e4 : MINUTOS_A_MANO;
    minutos_ahorrados = Math.max(0, Math.round(MINUTOS_A_MANO - tardo));
  }
  const { data: decidida, error } = await supabase
    .from("mentores_sugerencias")
    .update({ estado, decidido_por: coordinador.id, decidido_at: ahora.toISOString(), minutos_ahorrados })
    .eq("id", id)
    .eq("estado", "pendiente")
    .select("proyecto_id, mentor_id");
  if (error) throw error;
  revalidatePath("/mentores/match");
  revalidatePath("/mentores");
  if (minutos_ahorrados === null || !decidida.length) redirect("/mentores/match");
  // Solo si esta vez quedó aceptada (no si ya lo estaba): así el aviso sale una sola vez.
  const aviso = await avisarAsignacion(supabase, decidida[0].proyecto_id, decidida[0].mentor_id, await urlBase());
  redirect(`/mentores/match?ok=${encodeURIComponent(`Mentor asignado. Se ahorraron ${duracion(minutos_ahorrados)} frente a buscarlo a mano. ${aviso}`)}`);
}

// Asignar a mano un mentor que el agente no sugirió. Queda como una sugerencia aceptada (así el resto de la app
// la trata igual), colgada de un pedido manual para que no cuente en las métricas del agente.
async function asignarAMano(formData: FormData) {
  "use server";
  const coordinador = await requireRol();
  const proyectoId = String(formData.get("proyecto_id"));
  const mentorId = String(formData.get("mentor_id") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!mentorId) conError("Elegí qué mentor querés asignar.");
  if (motivo.length < 5) conError("Para asignar un mentor a mano hace falta contar por qué lo elegís.");

  const supabase = await createClient();
  const [mentor, yaEsta] = await Promise.all([
    supabase.from("personas").select("id").eq("id", mentorId).eq("rol", "mentor").maybeSingle(),
    supabase.from("mentores_sugerencias").select("id").eq("proyecto_id", proyectoId).eq("mentor_id", mentorId)
      .in("estado", ["aceptada", "pendiente"]),
  ]);
  if (mentor.error) throw mentor.error;
  if (yaEsta.error) throw yaEsta.error;
  if (!mentor.data) conError("Esa persona no es mentor.");
  if (yaEsta.data!.length) conError("Ese mentor ya está asignado o sugerido para este proyecto: aceptalo desde la sugerencia.");

  const { data: pedido, error } = await supabase
    .from("mentores_match_pedidos")
    .insert({ proyecto_id: proyectoId, pedido_por: coordinador.id, manual: true })
    .select("id")
    .single();
  if (error) throw error;
  const { error: errorAsignar } = await supabase.from("mentores_sugerencias").insert({
    pedido_id: pedido.id,
    proyecto_id: proyectoId,
    mentor_id: mentorId,
    afinidad: 0, // el agente no lo evaluó
    motivo,
    estado: "aceptada",
    decidido_por: coordinador.id,
    decidido_at: new Date().toISOString(),
  });
  if (errorAsignar) {
    await supabase.from("mentores_match_pedidos").delete().eq("id", pedido.id);
    throw errorAsignar;
  }
  revalidatePath("/mentores/match");
  revalidatePath("/mentores");
  const aviso = await avisarAsignacion(supabase, proyectoId, mentorId, await urlBase());
  redirect(`/mentores/match?ok=${encodeURIComponent(`Mentor asignado a mano. ${aviso}`)}`);
}

async function calificar(formData: FormData) {
  "use server";
  const coordinador = await requireRol();
  const estrellas = Number(formData.get("satisfaccion"));
  if (!Number.isInteger(estrellas) || estrellas < 1 || estrellas > 5) conError("Elegí de 1 a 5 estrellas para calificar el match.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("mentores_sugerencias")
    .update({
      satisfaccion: estrellas,
      opinion: String(formData.get("opinion") ?? "").trim() || null,
      calificado_por: coordinador.id,
      calificado_at: new Date().toISOString(),
    })
    .eq("id", String(formData.get("id")))
    .in("estado", ["aceptada", "quitada"]);
  if (error) throw error;
  revalidatePath("/mentores/match");
  redirect("/mentores/match");
}

async function quitar(formData: FormData) {
  "use server";
  const coordinador = await requireRol();
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (motivo.length < 5) conError("Para quitar un mentor hace falta contar el motivo.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("mentores_sugerencias")
    .update({ estado: "quitada", quitado_por: coordinador.id, quitado_at: new Date().toISOString(), motivo_quitado: motivo })
    .eq("id", String(formData.get("id")))
    .eq("estado", "aceptada");
  if (error) throw error;
  revalidatePath("/mentores/match");
  revalidatePath("/mentores");
  redirect("/mentores/match");
}

async function marcarRevisada(formData: FormData) {
  "use server";
  const coordinador = await requireRol();
  const supabase = await createClient();
  const { error } = await supabase
    .from("mentores_match_pedidos")
    .update({ alerta_revisada_at: new Date().toISOString(), alerta_revisada_por: coordinador.id })
    .eq("id", String(formData.get("id")));
  if (error) throw error;
  revalidatePath("/mentores/match");
  revalidatePath("/mentores");
  redirect("/mentores/match");
}

async function MensajeError({ searchParams }: Pick<PageProps<"/mentores/match">, "searchParams">) {
  const { error, ok } = await searchParams;
  if (error) return <p className="mb-6 border border-destructive p-3 text-sm text-destructive">{error}</p>;
  if (ok) return <p className="mb-6 border p-3 text-sm">⏱ {ok}</p>;
}

export default async function Match({ searchParams }: PageProps<"/mentores/match">) {
  await requireRol();
  const sinClaveIA = !process.env.AI_GATEWAY_API_KEY;
  const supabase = await createClient();
  const [proyectos, mentores, sugerencias, pedidos] = await Promise.all([
    supabase.from("proyectos").select("id, nombre, descripcion, estado").order("nombre"),
    supabase.from("personas").select("id, nombre").eq("rol", "mentor"),
    supabase.from("mentores_sugerencias").select("*").order("afinidad", { ascending: false }),
    supabase.from("mentores_match_pedidos").select("id, proyecto_id, aviso, alerta_revisada_at, created_at, manual").order("created_at", { ascending: false }),
  ]);
  for (const r of [proyectos, mentores, sugerencias, pedidos]) if (r.error) throw r.error;

  const nombreProyecto = (id: string) => proyectos.data!.find((p) => p.id === id)?.nombre ?? "Proyecto";
  const pedidosAgente = pedidos.data!.filter((x) => !x.manual);
  const pedidosManuales = new Set(pedidos.data!.filter((x) => x.manual).map((x) => x.id));
  const esManual = (s: { pedido_id: string }) => pedidosManuales.has(s.pedido_id);
  const alertas = pedidosAgente.filter((x) => x.aviso && !x.alerta_revisada_at);
  const nombre = (id: string) => mentores.data!.find((m) => m.id === id)?.nombre ?? "Mentor dado de baja";
  const pct = (parte: number, total: number) => (total ? `${Math.round((parte / total) * 100)}%` : "—");
  const decididas = sugerencias.data!.filter((s) => s.estado !== "pendiente");
  // Una quitada también fue aceptada en su momento.
  const aceptadas = decididas.filter((s) => s.estado === "aceptada" || s.estado === "quitada");
  const quitadas = decididas.filter((s) => s.estado === "quitada");
  const calificadas = aceptadas.filter((s) => s.satisfaccion !== null);
  const conMentor = new Set(decididas.filter((s) => s.estado === "aceptada").map((s) => s.proyecto_id));
  // Las asignaciones a mano no son sugerencias del agente: no cuentan para medirlo.
  const decididasAgente = decididas.filter((s) => !esManual(s));
  const aceptadasAgente = aceptadas.filter((s) => !esManual(s));
  const aMano = aceptadas.length - aceptadasAgente.length;
  const metricas = [
    ["Sugerencias aceptadas", pct(aceptadasAgente.length, decididasAgente.length)],
    ["Asignados a mano", pct(aMano, aceptadas.length)],
    ["Hubo que cambiar mentor", pct(quitadas.length, aceptadas.length)],
    ["Tiempo ahorrado", duracion(aceptadasAgente.reduce((total, s) => total + (s.minutos_ahorrados ?? 0), 0))],
    ["Satisfacción", calificadas.length ? `★ ${(calificadas.reduce((t, s) => t + s.satisfaccion!, 0) / calificadas.length).toFixed(1)}` : "—"],
    ["Pedidos al agente", pedidosAgente.length],
    ["Proyectos con mentor", `${conMentor.size} de ${proyectos.data!.length}`],
  ];

  return (
    <>
      <h1 className="mb-2 font-serif text-2xl">Match proyecto–mentor</h1>
      <p className="mb-8 max-w-2xl text-sm text-[#666]">
        El agente lee la descripción del proyecto y los perfiles de los mentores y sugiere hasta 3. Son solo
        sugerencias: nadie queda asignado hasta que lo aceptás. Si preferís a otro mentor, podés asignarlo a mano.
      </p>
      <Suspense><MensajeError searchParams={searchParams} /></Suspense>

      {sinClaveIA && (
        <p className="mb-8 max-w-2xl border p-4 text-sm text-[#666]">
          El agente no está disponible porque falta la clave de IA (AI_GATEWAY_API_KEY). Igual podés ver las
          métricas, los mentores asignados, quitarlos y calificar los matches; solo no se pueden pedir sugerencias nuevas.
        </p>
      )}

      {alertas.length > 0 && (
        <section id="alertas" className="mb-10 border border-primary p-6">
          <h2 className="mb-4 font-serif text-lg">⚠ Alertas del Match sin revisar ({alertas.length})</h2>
          <ul className="divide-y">
            {alertas.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-4 py-3">
                <div className="max-w-2xl text-sm">
                  <p className="font-medium">{nombreProyecto(a.proyecto_id)} · <span className="font-normal text-[#666]">{fechaCorta(a.created_at)}</span></p>
                  <p className="text-[#666]">{a.aviso}</p>
                </div>
                <form action={marcarRevisada}>
                  <input type="hidden" name="id" value={a.id} />
                  <BotonEnviar size="sm" variant="outline" enviando="…">Marcar como revisada</BotonEnviar>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-7">
        {metricas.map(([label, valor]) => (
          <Card key={label}>
            <CardHeader><CardTitle className="text-sm font-normal text-[#666]">{label}</CardTitle></CardHeader>
            <CardContent className="font-serif text-4xl">{valor}</CardContent>
          </Card>
        ))}
      </div>

      {proyectos.data!.length === 0 && <p className="text-[#666]">Todavía no hay proyectos cargados.</p>}

      <div className="grid gap-6">
        {proyectos.data!.map((p) => {
          const deEste = sugerencias.data!.filter((s) => s.proyecto_id === p.id);
          const asignados = deEste.filter((s) => s.estado === "aceptada");
          const anteriores = deEste.filter((s) => s.estado === "quitada");
          const pendientes = deEste.filter((s) => s.estado === "pendiente");
          const aviso = pedidosAgente.find((x) => x.proyecto_id === p.id)?.aviso;
          // Para asignar a mano: los que no están ya asignados ni esperando decisión en este proyecto.
          const ocupados = new Set(deEste.filter((s) => s.estado === "aceptada" || s.estado === "pendiente").map((s) => s.mentor_id));
          const libres = mentores.data!.filter((m) => !ocupados.has(m.id)).sort((a, b) => a.nombre.localeCompare(b.nombre));
          return (
            <section key={p.id} className="border bg-card p-6">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-3">
                    <h2 className="font-serif text-xl">{p.nombre}</h2>
                    <Badge variant="outline">{p.estado}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-[#666]">{p.descripcion || "Sin descripción"}</p>
                </div>
                <form action={pedirSugerencias}>
                  <input type="hidden" name="proyecto_id" value={p.id} />
                  <BotonEnviar enviando="El agente está pensando…" disabled={sinClaveIA}>
                    {deEste.length ? "Pedir más sugerencias" : "Pedir sugerencias al agente"}
                  </BotonEnviar>
                </form>
              </div>

              <div className="mb-4 text-sm">
                <span className="text-[#666]">Mentores: </span>
                {asignados.length === 0 && "ninguno todavía"}
                <ul className="mt-2 grid gap-2">
                  {asignados.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-start gap-3">
                      <span className="font-medium">{nombre(s.mentor_id)}</span>
                      {esManual(s) && <Badge variant="outline" title={s.motivo}>Asignado a mano</Badge>}
                      {s.minutos_ahorrados !== null && (
                        <span className="text-xs text-[#666]">⏱ se ahorraron {duracion(s.minutos_ahorrados)}</span>
                      )}
                      <details className="text-[#666]">
                        <summary className="cursor-pointer hover:text-primary">
                          {s.satisfaccion ? <span className="text-primary">{"★".repeat(s.satisfaccion)}{"☆".repeat(5 - s.satisfaccion)}</span> : "★ Calificar"}
                        </summary>
                        <form action={calificar} className="mt-2 grid w-80 gap-2">
                          <input type="hidden" name="id" value={s.id} />
                          <p className="text-xs">¿Cómo funcionó este match?</p>
                          <Estrellas name="satisfaccion" inicial={s.satisfaccion} />
                          <textarea name="opinion" rows={3} defaultValue={s.opinion ?? ""} placeholder="Tu opinión (opcional)"
                            className="border bg-background px-3 py-2 text-sm text-primary outline-none focus-visible:border-ring" />
                          <BotonEnviar size="sm" enviando="Guardando…">{s.satisfaccion ? "Guardar cambios" : "Guardar calificación"}</BotonEnviar>
                        </form>
                      </details>
                      <details className="text-[#666]">
                        <summary className="cursor-pointer hover:text-primary">Quitar</summary>
                        <form action={quitar} className="mt-2 grid w-80 gap-2">
                          <input type="hidden" name="id" value={s.id} />
                          <textarea name="motivo" required minLength={5} rows={2} placeholder="¿Por qué se quita? (obligatorio)"
                            className="border bg-background px-3 py-2 text-sm text-primary outline-none focus-visible:border-ring" />
                          <BotonEnviar size="sm" variant="destructive" enviando="Quitando…">Confirmar: quitar mentor</BotonEnviar>
                        </form>
                      </details>
                      {esManual(s) && <p className="w-full text-xs text-[#666]">Por qué: {s.motivo}</p>}
                      {s.opinion && <p className="w-full text-xs text-[#666]">“{s.opinion}”</p>}
                    </li>
                  ))}
                </ul>
                {libres.length > 0 && (
                  <details className="mt-3 text-[#666]">
                    <summary className="cursor-pointer hover:text-primary">+ Asignar otro mentor a mano</summary>
                    <form action={asignarAMano} className="mt-2 grid max-w-md gap-2">
                      <input type="hidden" name="proyecto_id" value={p.id} />
                      <select name="mentor_id" required defaultValue="" className="h-9 border bg-background px-2 text-sm text-primary">
                        <option value="" disabled>Elegí un mentor</option>
                        {libres.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                      </select>
                      <textarea name="motivo" required minLength={5} rows={2} placeholder="¿Por qué este mentor? (obligatorio)"
                        className="border bg-background px-3 py-2 text-sm text-primary outline-none focus-visible:border-ring" />
                      <p className="text-xs">Le avisamos por mail al mentor y al equipo, igual que al aceptar una sugerencia.</p>
                      <BotonEnviar size="sm" enviando="Asignando…">Asignar mentor</BotonEnviar>
                    </form>
                  </details>
                )}
                {anteriores.length > 0 && (
                  <p className="mt-3 text-xs text-[#666]">
                    Mentores anteriores: {anteriores.map((s) => `${nombre(s.mentor_id)} (${s.motivo_quitado})`).join(" · ")}
                  </p>
                )}
              </div>

              {aviso && <p className="mb-4 border-l-2 border-primary pl-3 text-sm">⚠ {aviso}</p>}

              {pendientes.length > 0 && (
                <>
                <p className="border-t pt-4 text-sm">
                  <span className="font-medium">Porcentaje de acierto</span>
                  <span className="text-xs text-[#666]"> · qué tanto se parece la trayectoria del mentor a este proyecto</span>
                </p>
                <ul className="divide-y">
                  {pendientes.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-4 py-4">
                      <span className="w-20 font-serif text-2xl">{s.afinidad}%</span>
                      <div className="min-w-60 flex-1">
                        <p className="font-medium">{nombre(s.mentor_id)}</p>
                        <p className="text-sm text-[#666]">{s.motivo}</p>
                      </div>
                      <form action={decidir} className="flex gap-2">
                        <input type="hidden" name="id" value={s.id} />
                        <BotonEnviar name="estado" value="aceptada" size="sm">Aceptar</BotonEnviar>
                        <BotonEnviar name="estado" value="rechazada" size="sm" variant="outline">Rechazar</BotonEnviar>
                      </form>
                    </li>
                  ))}
                </ul>
                </>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
