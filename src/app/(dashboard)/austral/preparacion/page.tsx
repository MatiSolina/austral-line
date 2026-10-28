// GRUPO AUSTRAL — panel de preparación de jurados (solo admin).
// Por evento y salón: qué jurados escuchan qué proyectos, si el equipo subió documentos, en qué estado está el material
// y si los jurados ya lo leyeron o escucharon. Desde acá se genera con IA y se entra a revisar y aprobar cada uno.
import Link from "next/link";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BotonEnviar } from "../_components/boton-enviar";
import { desactualizado, estados, fechaHora, recienEmpezado } from "../_preparacion";
import { generar } from "./acciones";
import { hayIA } from "./agente";

const porcentaje = (parte: number, total: number) => (total ? `${Math.round((parte / total) * 100)}%` : "—");

export default async function Preparacion({ searchParams }: PageProps<"/austral/preparacion">) {
  await requireRol(); // solo admin
  const { evento: eventoElegido, ok, error } = await searchParams;
  const supabase = await createClient();

  const { data: eventos, error: errorEventos } = await supabase.from("eventos").select("id, nombre, inicio").order("inicio");
  if (errorEventos) throw errorEventos;
  const desde = recienEmpezado();
  const evento = eventos.find((e) => e.id === eventoElegido) ?? eventos.find((e) => e.inicio >= desde) ?? eventos.at(-1);

  const encabezado = (
    <>
      <Link href="/austral" className="text-sm text-[#666] hover:text-primary">← Eventos</Link>
      <h1 className="mt-6 font-serif text-2xl">Preparación de jurados</h1>
      <p className="mt-1 mb-8 text-sm text-[#666]">
        Con los documentos que sube cada equipo, el agente arma una ficha y un audio que cuentan solo el problema que abordan,
        sin adelantar la solución. Revisalos y aprobalos: recién ahí los ven los jurados de ese salón en &quot;Preparación&quot;.
      </p>
    </>
  );
  if (!evento) {
    return (
      <div className="mx-auto max-w-5xl">
        {encabezado}
        <div className="border p-10 text-center text-sm text-[#666]">No hay eventos cargados.</div>
      </div>
    );
  }

  const [salones, materiales, documentos] = await Promise.all([
    supabase
      .from("jurado_salones")
      .select("id, nombre, jurado_salon_proyectos(proyectos(id, nombre)), jurado_salon_jurados(jurado_id, personas(nombre))")
      .eq("evento_id", evento.id)
      .order("orden"),
    supabase.from("austral_materiales").select("id, proyecto_id, estado, aviso, documentos, segundos_generacion, aprobado_at, austral_material_usos(jurado_id, tipo)"),
    supabase.from("austral_documentos").select("id, proyecto_id, created_at"),
  ]);
  for (const r of [salones, materiales, documentos]) if (r.error) throw r.error;

  const materialDe = new Map(materiales.data!.map((m) => [m.proyecto_id, m]));
  const documentosDe = new Map<string, { id: string; created_at: string }[]>();
  for (const d of documentos.data!) documentosDe.set(d.proyecto_id, [...(documentosDe.get(d.proyecto_id) ?? []), d]);

  // Métricas del evento: una "asignación" es un jurado que escucha un proyecto en su salón.
  const filas = salones.data!.flatMap((s) => s.jurado_salon_proyectos.map((sp) => ({ salon: s, proyecto: sp.proyectos })));
  const delEvento = filas.map((f) => materialDe.get(f.proyecto.id));
  const aprobados = delEvento.filter((m) => m?.estado === "aprobado");
  const aTiempo = aprobados.filter((m) => m!.aprobado_at! < evento.inicio);
  const conAviso = delEvento.filter((m) => m?.estado === "revisar");
  const tiempos = delEvento.map((m) => m?.segundos_generacion).filter((t): t is number => t != null);
  let asignaciones = 0, leidas = 0, escuchadas = 0;
  for (const { salon, proyecto } of filas) {
    const usos = materialDe.get(proyecto.id)?.austral_material_usos ?? [];
    for (const j of salon.jurado_salon_jurados) {
      asignaciones++;
      if (usos.some((u) => u.jurado_id === j.jurado_id && u.tipo === "lectura")) leidas++;
      if (usos.some((u) => u.jurado_id === j.jurado_id && u.tipo === "audio")) escuchadas++;
    }
  }
  const metricas = [
    { valor: `${aprobados.length}/${filas.length}`, texto: "materiales aprobados" },
    { valor: porcentaje(aTiempo.length, filas.length), texto: "aprobados antes del evento" },
    { valor: String(conAviso.length), texto: "con aviso para revisar" },
    { valor: tiempos.length ? `${Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length)} s` : "—", texto: "tiempo promedio de generación" },
    { valor: porcentaje(leidas, asignaciones), texto: "de los jurados abrió su material" },
    { valor: porcentaje(escuchadas, asignaciones), texto: "escuchó el audio" },
  ];
  const volver = `/austral/preparacion?evento=${evento.id}`;

  return (
    <div className="mx-auto max-w-5xl">
      {encabezado}

      <form className="mb-8 flex items-center gap-2">
        <select name="evento" defaultValue={evento.id} className="h-9 border bg-background px-2 text-sm">
          {eventos.map((e) => <option key={e.id} value={e.id}>{e.nombre} · {fechaHora(e.inicio)}</option>)}
        </select>
        <Button type="submit" variant="outline" size="sm">Ver</Button>
      </form>

      {ok && <p className="mb-6 border p-3 text-sm">{ok}</p>}
      {error && <p className="mb-6 border border-destructive p-3 text-sm text-destructive">{error}</p>}
      {!hayIA() && <p className="mb-6 border border-destructive p-3 text-sm text-destructive">Falta configurar AI_GATEWAY_API_KEY: sin eso no se puede generar el material.</p>}

      <div className="mb-10 grid grid-cols-2 border-t border-l sm:grid-cols-3">
        {metricas.map((m) => (
          <div key={m.texto} className="border-r border-b p-4">
            <div className="font-serif text-2xl">{m.valor}</div>
            <div className="text-sm text-[#666]">{m.texto}</div>
          </div>
        ))}
      </div>

      {salones.data!.length === 0 && (
        <div className="border p-10 text-center text-sm text-[#666]">
          Este evento no tiene salones armados. Los arma el grupo Jurado en Jurado → Salones: el material se prepara para los proyectos asignados a un salón.
        </div>
      )}

      {salones.data!.map((s) => (
        <section key={s.id} className="mb-10">
          <h2 className="font-serif text-xl">{s.nombre}</h2>
          <p className="mt-1 mb-4 text-sm text-[#666]">
            Jurados: {s.jurado_salon_jurados.map((j) => j.personas.nombre).join(", ") || "sin jurados asignados"}
          </p>
          {s.jurado_salon_proyectos.length === 0 ? (
            <div className="border p-6 text-center text-sm text-[#666]">Sin proyectos asignados.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Proyecto</TableHead><TableHead>Documentos</TableHead><TableHead>Material</TableHead><TableHead>Jurados</TableHead><TableHead /></TableRow>
              </TableHeader>
              <TableBody>
                {s.jurado_salon_proyectos.map(({ proyectos: p }) => {
                  const m = materialDe.get(p.id);
                  const docs = documentosDe.get(p.id) ?? [];
                  const ultimo = docs.map((d) => d.created_at).sort().at(-1);
                  const usos = m?.austral_material_usos ?? [];
                  const lectores = new Set(usos.filter((u) => u.tipo === "lectura").map((u) => u.jurado_id)).size;
                  const oyentes = new Set(usos.filter((u) => u.tipo === "audio").map((u) => u.jurado_id)).size;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>{p.nombre}</TableCell>
                      <TableCell className="text-[#666]">
                        {docs.length ? `${docs.length} · último ${fechaHora(ultimo!)}` : "Ninguno"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          {m ? <Badge variant={estados[m.estado].variante}>{estados[m.estado].texto}</Badge> : <span className="text-sm text-[#666]">Sin generar</span>}
                          {desactualizado(m, docs.map((d) => d.id)) && <Badge variant="outline">Documentos nuevos</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-[#666]">
                        {m?.estado === "aprobado" ? `${lectores}/${s.jurado_salon_jurados.length} leyeron · ${oyentes} escucharon` : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <form action={generar}>
                            <input type="hidden" name="proyecto_id" value={p.id} />
                            <input type="hidden" name="volver" value={volver} />
                            <BotonEnviar variant="outline" enviando="Generando…">{m ? "Regenerar" : "Generar"}</BotonEnviar>
                          </form>
                          {m && <Link href={`/austral/preparacion/${p.id}?evento=${evento.id}`} className="text-sm underline underline-offset-4">Revisar</Link>}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </section>
      ))}
    </div>
  );
}
