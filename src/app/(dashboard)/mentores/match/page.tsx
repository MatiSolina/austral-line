// GRUPO MENTORES — match proyecto–mentor. El agente sugiere; el coordinador decide.
import { Suspense } from "react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BotonEnviar } from "../_components/boton-enviar";
import { sugerirMentores } from "./agente";

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
  const { error } = await supabase
    .from("mentores_sugerencias")
    .update({ estado, decidido_por: coordinador.id, decidido_at: new Date().toISOString() })
    .eq("id", String(formData.get("id")))
    .eq("estado", "pendiente");
  if (error) throw error;
  revalidatePath("/mentores/match");
  revalidatePath("/mentores");
  redirect("/mentores/match");
}

async function MensajeError({ searchParams }: Pick<PageProps<"/mentores/match">, "searchParams">) {
  const { error } = await searchParams;
  return error && <p className="mb-6 border border-destructive p-3 text-sm text-destructive">{error}</p>;
}

export default async function Match({ searchParams }: PageProps<"/mentores/match">) {
  await requireRol();
  const supabase = await createClient();
  const [proyectos, mentores, sugerencias, pedidos] = await Promise.all([
    supabase.from("proyectos").select("id, nombre, descripcion, estado").order("nombre"),
    supabase.from("personas").select("id, nombre").eq("rol", "mentor"),
    supabase.from("mentores_sugerencias").select("*").order("afinidad", { ascending: false }),
    supabase.from("mentores_match_pedidos").select("proyecto_id, aviso, created_at").order("created_at", { ascending: false }),
  ]);
  for (const r of [proyectos, mentores, sugerencias, pedidos]) if (r.error) throw r.error;

  const nombre = (id: string) => mentores.data!.find((m) => m.id === id)?.nombre ?? "Mentor dado de baja";
  const decididas = sugerencias.data!.filter((s) => s.estado !== "pendiente");
  const aceptadas = decididas.filter((s) => s.estado === "aceptada");
  const conMentor = new Set(aceptadas.map((s) => s.proyecto_id));
  const metricas = [
    ["Sugerencias aceptadas", decididas.length ? `${Math.round((aceptadas.length / decididas.length) * 100)}%` : "—"],
    ["Pedidos al agente", pedidos.data!.length],
    ["Proyectos con mentor", `${conMentor.size} de ${proyectos.data!.length}`],
  ];

  return (
    <>
      <h1 className="mb-2 font-serif text-2xl">Match proyecto–mentor</h1>
      <p className="mb-8 max-w-2xl text-sm text-[#666]">
        El agente lee la descripción del proyecto y los perfiles de los mentores y sugiere hasta 3. Son solo
        sugerencias: nadie queda asignado hasta que lo aceptás.
      </p>
      <Suspense><MensajeError searchParams={searchParams} /></Suspense>

      <div className="mb-10 grid gap-4 sm:grid-cols-3">
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
          const pendientes = deEste.filter((s) => s.estado === "pendiente");
          const aviso = pedidos.data!.find((x) => x.proyecto_id === p.id)?.aviso;
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
                  <BotonEnviar variant="outline" enviando="Pensando…">
                    {deEste.length ? "Pedir más sugerencias" : "Pedir sugerencias"}
                  </BotonEnviar>
                </form>
              </div>

              <p className="mb-4 text-sm">
                <span className="text-[#666]">Mentores: </span>
                {asignados.length ? asignados.map((s) => nombre(s.mentor_id)).join(", ") : "ninguno todavía"}
              </p>

              {aviso && <p className="mb-4 border-l-2 border-primary pl-3 text-sm">⚠ {aviso}</p>}

              {pendientes.length > 0 && (
                <ul className="divide-y border-t">
                  {pendientes.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-4 py-4">
                      <span className="w-14 font-serif text-2xl">{s.afinidad}</span>
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
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
