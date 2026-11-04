// GRUPO ALUMNOS — "Armar grupo": proponer un grupo, invitar compañeros, aceptar invitaciones y enviarlo a los
// profesores. Si ya tiene grupo, el alumno puede pedir un cambio (salir o pasarse a otro), que aprueban los profesores.
import { Suspense } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { calcularAfinidad } from "../_lib/afinidad";
import { evaluarGrupo } from "../_lib/interdisciplina";
import { MAX_INTEGRANTES, MIN_INTEGRANTES, fechaCierre } from "../_lib/armado";
import {
  cancelarSolicitud,
  crearPropuesta,
  enviarPropuesta,
  invitar,
  pedirCambio,
  responderInvitacion,
  salirPropuesta,
} from "./_acciones";

const campo = "border bg-background px-2.5 py-2 text-sm outline-none focus-visible:border-ring";
const ESTADO_MIEMBRO = { aceptado: "Está", invitado: "Invitado", rechazado: "No se sumó" } as const;
const ESTADO_SOLICITUD = { pendiente: "Pendiente", aprobada: "Aprobada", rechazada: "Rechazada", cancelada: "Cancelada" } as const;

async function Aviso({ searchParams }: Pick<PageProps<"/alumnos/grupo">, "searchParams">) {
  const { error, ok } = await searchParams;
  if (error) return <p className="mb-6 border bg-card px-4 py-3 text-sm text-destructive">{String(error)}</p>;
  if (ok) return <p className="mb-6 border bg-card px-4 py-3 text-sm">{String(ok)}</p>;
  return null;
}

function Requisito({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-2 text-sm ${ok ? "" : "text-destructive"}`}>
      {ok ? <Check className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
      <span>{children}</span>
    </li>
  );
}

export default async function ArmarGrupo({ searchParams }: PageProps<"/alumnos/grupo">) {
  const persona = await requireRol("alumno");
  const titulo = (
    <>
      <h1 className="mb-2 font-serif text-2xl">Armar grupo</h1>
      <p className="mb-6 max-w-2xl text-sm text-[#666]">
        Proponé un grupo e invitá a tus compañeros. Tiene que tener de {MIN_INTEGRANTES} a {MAX_INTEGRANTES} integrantes y
        ser interdisciplinario (al menos 2 carreras). Cuando estén todos, lo envían a los profesores para que lo aprueben.
      </p>
    </>
  );
  if (persona.rol !== "alumno") {
    return (
      <div className="max-w-xl border bg-card p-8">
        {titulo}
        <Link href="/alumnos/aprobaciones" className="text-sm underline underline-offset-4">Ir a Aprobar grupos</Link>
      </div>
    );
  }

  const supabase = await createClient();
  const [config, miProyecto, propuestas, carreras, ideas, misSolicitudes, proyectos, respuestas, maestro] = await Promise.all([
    supabase.from("alumnos_armado_config").select("cierre").eq("id", 1).maybeSingle(),
    supabase.from("proyecto_integrantes").select("proyecto_id, proyectos(nombre)").eq("persona_id", persona.id),
    supabase
      .from("alumnos_propuestas")
      .select(
        "id, nombre, estado, comentario_profesores, creada_por, alumnos_ideas(titulo), alumnos_propuesta_miembros(persona_id, estado, invitado_por, personas!alumnos_propuesta_miembros_persona_id_fkey(nombre))",
      )
      .in("estado", ["armando", "enviada"])
      .order("created_at"),
    supabase.from("alumnos_carreras").select("persona_id, alumnos_carreras_maestro(nombre)"),
    supabase.rpc("alumnos_ideas_libres"),
    supabase
      .from("alumnos_solicitudes_cambio")
      .select("id, estado, motivo, respuesta, created_at, destino:proyectos!alumnos_solicitudes_cambio_proyecto_destino_fkey(nombre)")
      .eq("persona_id", persona.id)
      .order("created_at", { ascending: false }),
    supabase.from("proyectos").select("id, nombre").order("nombre"),
    supabase.from("alumnos_intereses").select("persona_id, interes_id, estrellas"),
    supabase.from("alumnos_intereses_maestro").select("id, nombre"),
  ]);
  for (const r of [config, miProyecto, propuestas, carreras, ideas, misSolicitudes, proyectos, respuestas, maestro]) {
    if (r.error) throw r.error;
  }

  const cierre = config.data?.cierre ?? null;
  const abierto = !cierre || new Date(cierre) > new Date();
  const carreraDe = new Map(carreras.data!.map((c) => [c.persona_id, c.alumnos_carreras_maestro.nombre]));
  const avisoCierre = (
    <p className="mb-6 text-sm text-[#666]">
      {cierre
        ? abierto
          ? `El armado de grupos cierra el ${fechaCierre(cierre)}.`
          : `El armado de grupos cerró el ${fechaCierre(cierre)}. Para cualquier cambio, hablá con los profesores.`
        : "Los profesores todavía no fijaron la fecha de cierre del armado."}
    </p>
  );

  // Ya tiene grupo: pedir un cambio ---------------------------------------------------------
  if (miProyecto.data!.length > 0) {
    const actual = miProyecto.data![0];
    const pendiente = misSolicitudes.data!.find((s) => s.estado === "pendiente");
    return (
      <>
        {titulo}
        <Suspense><Aviso searchParams={searchParams} /></Suspense>
        <section className="mb-8 grid max-w-2xl gap-2 border bg-card p-6">
          <p className="text-sm text-[#666]">Tu grupo</p>
          <p className="font-serif text-xl">{actual.proyectos.nombre}</p>
          <Link href="/alumnos" className="text-sm underline underline-offset-4">Ver en Proyectos</Link>
        </section>

        <section className="grid max-w-2xl gap-4">
          <div>
            <h2 className="font-serif text-lg">Pedir un cambio de grupo</h2>
            <p className="text-sm text-[#666]">Lo revisan los profesores. Tu grupo actual no cambia hasta que lo aprueben.</p>
          </div>
          {pendiente ? (
            <div className="grid gap-2 border bg-card p-5 text-sm">
              <p>
                Pediste {pendiente.destino ? <>pasarte a <strong className="font-medium">{pendiente.destino.nombre}</strong></> : "salir del grupo"}.
                Los profesores todavía no respondieron.
              </p>
              <p className="border-l-2 pl-3 text-[#666]">{pendiente.motivo}</p>
              <form action={cancelarSolicitud}>
                <input type="hidden" name="solicitud_id" value={pendiente.id} />
                <Button type="submit" size="sm" variant="outline">Cancelar la solicitud</Button>
              </form>
            </div>
          ) : (
            <form action={pedirCambio} className="grid gap-3 border bg-card p-5">
              <input type="hidden" name="origen" value={actual.proyecto_id} />
              <div className="grid max-w-sm gap-2">
                <Label htmlFor="destino">¿Qué querés hacer?</Label>
                <select id="destino" name="destino" defaultValue="" required className="h-8 border bg-background px-2 text-sm">
                  <option value="" disabled>Elegí una opción</option>
                  <option value="salir">Salir del grupo</option>
                  {proyectos.data!
                    .filter((p) => p.id !== actual.proyecto_id)
                    .map((p) => <option key={p.id} value={p.id}>Pasarme a {p.nombre}</option>)}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="motivo">Motivo</Label>
                <textarea id="motivo" name="motivo" required minLength={5} maxLength={500} rows={3} className={campo} />
              </div>
              <div><Button type="submit" size="sm">Enviar a los profesores</Button></div>
            </form>
          )}
          {misSolicitudes.data!.filter((s) => s.estado !== "pendiente").length > 0 && (
            <ul className="grid gap-2 text-sm">
              {misSolicitudes.data!
                .filter((s) => s.estado !== "pendiente")
                .map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-2 border bg-background px-4 py-2">
                    <Badge variant="outline">{ESTADO_SOLICITUD[s.estado as keyof typeof ESTADO_SOLICITUD]}</Badge>
                    <span>{s.destino ? `Pasarme a ${s.destino.nombre}` : "Salir del grupo"}</span>
                    {s.respuesta && <span className="text-[#666]">· Profesores: {s.respuesta}</span>}
                  </li>
                ))}
            </ul>
          )}
        </section>
      </>
    );
  }

  // Sin grupo: propuesta activa, invitaciones o crear una --------------------------------------------
  const miEstadoEn = (p: NonNullable<typeof propuestas.data>[number]) =>
    p.alumnos_propuesta_miembros.find((m) => m.persona_id === persona.id)?.estado;
  const activa = propuestas.data!.find((p) => miEstadoEn(p) === "aceptado");
  const invitaciones = propuestas.data!.filter((p) => p.estado === "armando" && miEstadoEn(p) === "invitado");

  const listaMiembros = (p: NonNullable<typeof activa>, mostrarEstado: boolean) => (
    <ul className="grid gap-1 text-sm">
      {p.alumnos_propuesta_miembros
        .filter((m) => m.estado !== "rechazado" || mostrarEstado)
        .map((m) => (
          <li key={m.persona_id} className="flex flex-wrap items-center gap-2">
            <span>{m.personas.nombre}{m.persona_id === persona.id && <span className="text-[#666]"> (vos)</span>}</span>
            <span className="text-[#666]">· {carreraDe.get(m.persona_id) ?? "sin carrera elegida"}</span>
            {mostrarEstado && <Badge variant={m.estado === "aceptado" ? "default" : "outline"}>{ESTADO_MIEMBRO[m.estado as keyof typeof ESTADO_MIEMBRO]}</Badge>}
          </li>
        ))}
    </ul>
  );

  const bloqueInvitaciones = invitaciones.length > 0 && (
    <section className="mb-8 grid max-w-3xl gap-3">
      <h2 className="font-serif text-lg">Te invitaron ({invitaciones.length})</h2>
      {invitaciones.map((p) => {
        const quien = p.alumnos_propuesta_miembros.find((m) => m.persona_id === p.creada_por)?.personas.nombre;
        return (
          <article key={p.id} className="grid gap-3 border-2 border-primary bg-card p-5">
            <div>
              <p className="font-serif text-lg">{p.nombre}</p>
              <p className="text-sm text-[#666]">
                Lo propone {quien ?? "un compañero"}
                {p.alumnos_ideas && <> · Idea: {p.alumnos_ideas.titulo}</>}
              </p>
            </div>
            {listaMiembros(p, false)}
            <div className="flex flex-wrap gap-2">
              <form action={responderInvitacion}>
                <input type="hidden" name="propuesta_id" value={p.id} />
                <input type="hidden" name="respuesta" value="aceptar" />
                <Button type="submit" size="sm" disabled={!!activa}>Sumarme</Button>
              </form>
              <form action={responderInvitacion}>
                <input type="hidden" name="propuesta_id" value={p.id} />
                <input type="hidden" name="respuesta" value="rechazar" />
                <Button type="submit" size="sm" variant="outline">No, gracias</Button>
              </form>
            </div>
            {activa && <p className="text-xs text-[#666]">Para sumarte, primero salí de “{activa.nombre}”.</p>}
          </article>
        );
      })}
    </section>
  );

  if (!activa) {
    return (
      <>
        {titulo}
        {avisoCierre}
        <Suspense><Aviso searchParams={searchParams} /></Suspense>
        {bloqueInvitaciones}
        {abierto ? (
          <section className="grid max-w-2xl gap-4">
            <div>
              <h2 className="font-serif text-lg">Proponer un grupo</h2>
              <p className="text-sm text-[#666]">
                ¿Todavía no sabés con quién? Mirá <Link href="/alumnos/afines" className="underline underline-offset-4">Compañeros afines</Link> y
                el <Link href="/alumnos/ideas" className="underline underline-offset-4">Banco de ideas</Link>.
              </p>
            </div>
            <form action={crearPropuesta} className="grid gap-3 border bg-card p-5">
              <div className="grid gap-2">
                <Label htmlFor="nombre">Nombre tentativo del grupo</Label>
                <input id="nombre" name="nombre" required minLength={2} maxLength={80} className={`h-8 ${campo} py-0`} />
              </div>
              <div className="grid max-w-md gap-2">
                <Label htmlFor="idea_id">Idea del banco (opcional)</Label>
                <select id="idea_id" name="idea_id" defaultValue="" className="h-8 border bg-background px-2 text-sm">
                  <option value="">Todavía no elegimos idea</option>
                  {ideas.data!.map((i) => <option key={i.id} value={i.id}>{i.titulo}</option>)}
                </select>
              </div>
              <div><Button type="submit" size="sm">Crear propuesta</Button></div>
            </form>
          </section>
        ) : (
          <p className="max-w-2xl border bg-card p-5 text-sm">
            Como el armado cerró y no tenés grupo, escribiles a los profesores para que te asignen uno.
          </p>
        )}
      </>
    );
  }

  // Propuesta activa ------------------------------------------------------------------------------
  const aceptados = activa.alumnos_propuesta_miembros.filter((m) => m.estado === "aceptado");
  const invitados = activa.alumnos_propuesta_miembros.filter((m) => m.estado === "invitado");
  const { estado: inter } = evaluarGrupo(aceptados.map((m) => carreraDe.get(m.persona_id)));
  const tamanoOk = aceptados.length >= MIN_INTEGRANTES && aceptados.length <= MAX_INTEGRANTES;
  const carrerasOk = aceptados.every((m) => carreraDe.has(m.persona_id));
  const listoParaEnviar = tamanoOk && carrerasOk && inter === "Interdisciplinario";
  const enArmado = activa.estado === "armando";
  const lugares = MAX_INTEGRANTES - aceptados.length - invitados.length;

  // Candidatos para invitar (alumnos sin grupo ni propuesta), con afinidad si buscan equipo.
  const candidatos = enArmado && abierto ? await supabase.rpc("alumnos_candidatos", { p_propuesta: activa.id }) : { data: [], error: null };
  if (candidatos.error) throw candidatos.error;
  const nombreTema = new Map(maestro.data!.map((m) => [m.id, m.nombre]));
  const estrellasDe = (id: string) =>
    new Map(respuestas.data!.filter((r) => r.persona_id === id).map((r) => [r.interes_id, r.estrellas]));
  const yo = { carrera: carreraDe.get(persona.id) ?? "", estrellas: estrellasDe(persona.id) };
  const carrerasDelGrupo = new Set(aceptados.map((m) => carreraDe.get(m.persona_id)).filter(Boolean));
  const conAfinidad = (candidatos.data ?? []).map((c) => ({
    ...c,
    afinidad: c.busca_equipo && c.carrera ? calcularAfinidad(yo, { carrera: c.carrera, estrellas: estrellasDe(c.persona_id) }, (id) => nombreTema.get(id) ?? "?") : null,
    sumaCarrera: !!c.carrera && !carrerasDelGrupo.has(c.carrera),
  }));
  conAfinidad.sort((a, b) => Number(b.sumaCarrera) - Number(a.sumaCarrera) || (b.afinidad?.puntaje ?? -99) - (a.afinidad?.puntaje ?? -99));

  return (
    <>
      {titulo}
      {avisoCierre}
      <Suspense><Aviso searchParams={searchParams} /></Suspense>
      {bloqueInvitaciones}

      <section className="grid max-w-3xl gap-5 border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-[#666]">Tu propuesta de grupo</p>
            <p className="font-serif text-2xl">{activa.nombre}</p>
            {activa.alumnos_ideas && <p className="text-sm text-[#666]">Idea: {activa.alumnos_ideas.titulo}</p>}
          </div>
          <Badge variant={enArmado ? "outline" : "default"}>{enArmado ? "Armando" : "Esperando a los profesores"}</Badge>
        </div>

        {activa.comentario_profesores && (
          <div className="border-2 border-destructive bg-background p-4 text-sm">
            <p className="font-medium text-destructive">Los profesores lo devolvieron con este comentario:</p>
            <p className="mt-1 whitespace-pre-line">{activa.comentario_profesores}</p>
          </div>
        )}

        {listaMiembros(activa, true)}

        <ul className="grid gap-1">
          <Requisito ok={tamanoOk}>De {MIN_INTEGRANTES} a {MAX_INTEGRANTES} integrantes (son {aceptados.length})</Requisito>
          <Requisito ok={carrerasOk}>Todos eligieron su carrera</Requisito>
          <Requisito ok={inter === "Interdisciplinario"}>Interdisciplinario: al menos 2 carreras distintas</Requisito>
        </ul>

        {enArmado ? (
          <div className="flex flex-wrap items-center gap-3">
            <form action={enviarPropuesta}>
              <input type="hidden" name="propuesta_id" value={activa.id} />
              <Button type="submit" disabled={!listoParaEnviar}>Enviar a los profesores</Button>
            </form>
            {!listoParaEnviar && <span className="text-sm text-[#666]">Cuando se cumplan los tres requisitos, lo pueden enviar.</span>}
            {listoParaEnviar && invitados.length > 0 && (
              <span className="text-sm text-[#666]">Al enviarlo, las invitaciones sin responder se cancelan.</span>
            )}
          </div>
        ) : (
          <p className="text-sm">Lo enviaron a los profesores. Cuando lo aprueben, el grupo aparece en Proyectos.</p>
        )}

        <details className="text-sm">
          <summary className="cursor-pointer text-[#666] hover:text-destructive">Salir de esta propuesta</summary>
          <form action={salirPropuesta} className="mt-2 grid gap-2 border bg-background p-3">
            <input type="hidden" name="propuesta_id" value={activa.id} />
            <p>
              {aceptados.length === 1
                ? "Sos el único integrante: la propuesta se cancela."
                : enArmado
                  ? "El resto del grupo sigue con la propuesta."
                  : "El resto sigue, pero la propuesta vuelve a armado y la tienen que enviar de nuevo."}
            </p>
            <div><Button type="submit" size="sm" variant="outline">Sí, salir</Button></div>
          </form>
        </details>
      </section>

      {enArmado && abierto && (
        <section className="mt-8 grid max-w-3xl gap-3">
          <div>
            <h2 className="font-serif text-lg">Invitar compañeros</h2>
            <p className="text-sm text-[#666]">
              Alumnos que todavía no tienen grupo. Primero, los de carreras que el grupo no tiene; de quienes no buscan
              equipo no se muestra la carrera. {lugares > 0 ? `Quedan ${lugares} lugares.` : "El grupo ya está completo."}
            </p>
          </div>
          {conAfinidad.length === 0 ? (
            <p className="text-sm text-[#666]">No hay más alumnos sin grupo para invitar.</p>
          ) : (
            <ul className="grid gap-2">
              {conAfinidad.map((c) => (
                <li key={c.persona_id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border bg-background px-4 py-3 text-sm">
                  <span className="font-medium">{c.nombre}</span>
                  <span className="text-[#666]">{c.carrera ?? "carrera no visible"}</span>
                  {c.sumaCarrera && <Badge>Suma una carrera</Badge>}
                  {c.afinidad && <Badge variant="outline">{c.afinidad.nivel}</Badge>}
                  <form action={invitar} className="ml-auto">
                    <input type="hidden" name="propuesta_id" value={activa.id} />
                    <input type="hidden" name="persona_id" value={c.persona_id} />
                    <Button type="submit" size="sm" variant="outline" disabled={lugares <= 0}>Invitar</Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
