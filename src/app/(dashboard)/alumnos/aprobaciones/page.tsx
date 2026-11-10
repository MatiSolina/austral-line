// GRUPO ALUMNOS — "Aprobar grupos" (solo profesores): fecha de cierre del armado, propuestas de grupo para
// aprobar o devolver, y solicitudes de cambio de grupo.
import { Suspense } from "react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { evaluarGrupo } from "../_lib/interdisciplina";
import { MAX_INTEGRANTES, MIN_INTEGRANTES, fechaCierre } from "../_lib/armado";
import { aprobarPropuesta, devolverPropuesta, guardarCierre, resolverSolicitud } from "./_acciones";

const campo = "border bg-background px-2.5 py-2 text-sm outline-none focus-visible:border-ring";
const ZONA = "America/Argentina/Buenos_Aires";
// Valor para <input type="datetime-local"> en hora de Argentina.
const paraInput = (iso: string) =>
  new Date(iso).toLocaleString("sv-SE", { timeZone: ZONA, hour12: false }).replace(" ", "T").slice(0, 16);

async function Aviso({ searchParams }: Pick<PageProps<"/alumnos/aprobaciones">, "searchParams">) {
  const { error, ok } = await searchParams;
  if (error) return <p className="mb-6 border bg-card px-4 py-3 text-sm text-destructive">{String(error)}</p>;
  if (ok) return <p className="mb-6 border bg-card px-4 py-3 text-sm">{String(ok)}</p>;
  return null;
}

export default async function AprobarGrupos({ searchParams }: PageProps<"/alumnos/aprobaciones">) {
  await requireRol(); // sin roles = solo admin (profesores)
  const supabase = await createClient();

  const [config, propuestas, carreras, solicitudes, integrantes, alumnos] = await Promise.all([
    supabase.from("alumnos_armado_config").select("cierre").eq("id", 1).maybeSingle(),
    supabase
      .from("alumnos_propuestas")
      .select(
        "id, nombre, estado, updated_at, alumnos_ideas(titulo), alumnos_propuesta_miembros(persona_id, estado, personas!alumnos_propuesta_miembros_persona_id_fkey(nombre))",
      )
      .in("estado", ["armando", "enviada"])
      .order("updated_at"),
    supabase.from("alumnos_carreras").select("persona_id, alumnos_carreras_maestro(nombre)"),
    supabase
      .from("alumnos_solicitudes_cambio")
      .select(
        "id, motivo, created_at, persona_id, proyecto_origen, quien:personas!alumnos_solicitudes_cambio_persona_id_fkey(nombre), origen:proyectos!alumnos_solicitudes_cambio_proyecto_origen_fkey(nombre), destino:proyectos!alumnos_solicitudes_cambio_proyecto_destino_fkey(nombre)",
      )
      .eq("estado", "pendiente")
      .order("created_at"),
    supabase.from("proyecto_integrantes").select("persona_id, proyecto_id"),
    supabase.from("personas_contacto").select("id, nombre, email").eq("rol", "alumno").order("nombre"),
  ]);
  for (const r of [config, propuestas, carreras, solicitudes, integrantes, alumnos]) if (r.error) throw r.error;

  const cierre = config.data?.cierre ?? null;
  const carreraDe = new Map(carreras.data!.map((c) => [c.persona_id, c.alumnos_carreras_maestro.nombre]));
  const enviadas = propuestas.data!.filter((p) => p.estado === "enviada");

  // Cómo queda el grupo de origen si se aprueba una solicitud: avisa si queda con menos de 2 integrantes
  // o con una sola carrera, para que los profesores lo sepan antes de decidir.
  const avisoOrigen = (proyectoOrigen: string, persona: string) => {
    const quedan = integrantes.data!.filter((i) => i.proyecto_id === proyectoOrigen && i.persona_id !== persona);
    if (quedan.length < 2) {
      return quedan.length === 0 ? "Si la aprobás, el grupo de origen queda sin integrantes." : "Si la aprobás, el grupo de origen queda con 1 solo integrante.";
    }
    const conCarrera = quedan.filter((i) => carreraDe.has(i.persona_id));
    const distintas = new Set(conCarrera.map((i) => carreraDe.get(i.persona_id)));
    if (conCarrera.length === quedan.length && distintas.size < 2) {
      return `Si la aprobás, el grupo de origen deja de ser interdisciplinario: quedan todos de ${[...distintas][0]}.`;
    }
    return null;
  };
  const armando = propuestas.data!.filter((p) => p.estado === "armando");

  // Alumnos que todavía no tienen grupo ni están en una propuesta.
  const ocupados = new Set([
    ...integrantes.data!.map((i) => i.persona_id),
    ...propuestas.data!.flatMap((p) => p.alumnos_propuesta_miembros.filter((m) => m.estado === "aceptado").map((m) => m.persona_id)),
  ]);
  const sueltos = alumnos.data!.filter((a) => !ocupados.has(a.id));

  return (
    <>
      <h1 className="mb-2 font-serif text-2xl">Aprobar grupos</h1>
      <p className="mb-6 max-w-2xl text-sm text-[#666]">
        Los alumnos proponen sus grupos ({MIN_INTEGRANTES} a {MAX_INTEGRANTES} integrantes, interdisciplinarios) y los
        envían acá. Al aprobar uno, se crea el proyecto con sus integrantes. Solo lo ven los profesores.
      </p>
      <Suspense><Aviso searchParams={searchParams} /></Suspense>

      <section className="mb-10 grid max-w-3xl gap-3 border bg-card p-6">
        <h2 className="font-serif text-lg">Cierre del armado</h2>
        <p className="text-sm text-[#666]">
          {cierre ? `Cierra el ${fechaCierre(cierre)}.` : "Sin fecha de cierre."} Después del cierre, los alumnos no pueden
          proponer ni invitar; los cambios se piden como solicitud.
        </p>
        <form action={guardarCierre} className="flex flex-wrap items-end gap-3">
          <div className="grid gap-2">
            <Label htmlFor="cierre">Fecha y hora de cierre</Label>
            <input id="cierre" name="cierre" type="datetime-local" defaultValue={cierre ? paraInput(cierre) : ""} className={`h-8 ${campo} py-0`} />
          </div>
          <Button type="submit" size="sm">Guardar</Button>
          <span className="text-xs text-[#666]">Dejalo vacío para quitar la fecha.</span>
        </form>
      </section>

      <section className="mb-10 grid max-w-3xl gap-3">
        <h2 className="font-serif text-lg">Esperando aprobación ({enviadas.length})</h2>
        {enviadas.length === 0 && <p className="text-sm text-[#666]">No hay grupos esperando aprobación.</p>}
        {enviadas.map((p) => {
          const miembros = p.alumnos_propuesta_miembros.filter((m) => m.estado === "aceptado");
          const { estado, distintas } = evaluarGrupo(miembros.map((m) => carreraDe.get(m.persona_id)));
          return (
            <article key={p.id} className="grid gap-3 border-2 border-primary bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-serif text-xl">{p.nombre}</p>
                  {p.alumnos_ideas && <p className="text-sm text-[#666]">Idea: {p.alumnos_ideas.titulo}</p>}
                </div>
                <Badge variant={estado === "Interdisciplinario" ? "default" : "outline"}>
                  {estado === "Interdisciplinario" ? `${distintas.length} carreras` : estado}
                </Badge>
              </div>
              <ul className="grid gap-1 text-sm">
                {miembros.map((m) => (
                  <li key={m.persona_id}>
                    {m.personas.nombre} <span className="text-[#666]">· {carreraDe.get(m.persona_id) ?? "sin carrera"}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-start gap-3">
                <form action={aprobarPropuesta}>
                  <input type="hidden" name="propuesta_id" value={p.id} />
                  <Button type="submit" size="sm">Aprobar y crear el proyecto</Button>
                </form>
                <details className="text-sm">
                  <summary className="cursor-pointer px-2 py-1 text-[#666] hover:text-primary">Devolver con un comentario</summary>
                  <form action={devolverPropuesta} className="mt-2 grid gap-2">
                    <input type="hidden" name="propuesta_id" value={p.id} />
                    <textarea name="comentario" required maxLength={1000} rows={2} aria-label="Comentario para el grupo" className={campo} />
                    <div><Button type="submit" size="sm" variant="outline">Devolver al grupo</Button></div>
                  </form>
                </details>
              </div>
            </article>
          );
        })}
      </section>

      <section className="mb-10 grid max-w-3xl gap-3">
        <h2 className="font-serif text-lg">Solicitudes de cambio de grupo ({solicitudes.data!.length})</h2>
        {solicitudes.data!.length === 0 && <p className="text-sm text-[#666]">No hay solicitudes pendientes.</p>}
        {solicitudes.data!.map((s) => (
          <article key={s.id} className="grid gap-3 border bg-card p-5 text-sm">
            <p>
              <strong className="font-medium">{s.quien.nombre}</strong> (de {s.origen.nombre}) pide{" "}
              {s.destino ? <>pasarse a <strong className="font-medium">{s.destino.nombre}</strong></> : "salir del grupo"}.
            </p>
            <p className="border-l-2 pl-3 text-[#666]">{s.motivo}</p>
            {avisoOrigen(s.proyecto_origen, s.persona_id) && (
              <p className="border border-destructive px-3 py-2 text-destructive">{avisoOrigen(s.proyecto_origen, s.persona_id)}</p>
            )}
            <form action={resolverSolicitud} className="grid gap-2">
              <input type="hidden" name="solicitud_id" value={s.id} />
              <textarea name="respuesta" maxLength={1000} rows={2} placeholder="Respuesta para el alumno (opcional)" aria-label="Respuesta" className={campo} />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" name="decision" value="aprobar" size="sm">Aprobar</Button>
                <Button type="submit" name="decision" value="rechazar" size="sm" variant="outline">Rechazar</Button>
              </div>
            </form>
          </article>
        ))}
      </section>

      <section className="grid max-w-3xl gap-6 md:grid-cols-2">
        <div className="grid content-start gap-2">
          <h2 className="font-serif text-lg">Propuestas en armado ({armando.length})</h2>
          {armando.length === 0 ? (
            <p className="text-sm text-[#666]">Ninguna.</p>
          ) : (
            <ul className="grid gap-1 text-sm">
              {armando.map((p) => (
                <li key={p.id}>
                  {p.nombre}{" "}
                  <span className="text-[#666]">
                    · {p.alumnos_propuesta_miembros.filter((m) => m.estado === "aceptado").length} integrantes,{" "}
                    {p.alumnos_propuesta_miembros.filter((m) => m.estado === "invitado").length} invitados
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="grid content-start gap-2">
          <h2 className="font-serif text-lg">Alumnos sin grupo ({sueltos.length})</h2>
          {sueltos.length === 0 ? (
            <p className="text-sm text-[#666]">Todos tienen grupo o están en una propuesta.</p>
          ) : (
            <ul className="grid gap-1 text-sm">
              {sueltos.map((a) => (
                <li key={a.id}>
                  {a.nombre} · <a href={`mailto:${a.email}`} className="underline underline-offset-4 hover:text-[#666]">{a.email}</a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
