// GRUPO AUSTRAL — por qué el agente recomienda (o no) a un alumno para un proyecto, otras alternativas y la decisión del admin.
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { BotonEnviar } from "../../../../_components/boton-enviar";
import { campoClase, Encabezado } from "../../../_components/encabezado";
import { cargarMatching, claseEstado, hayIA } from "../../../_datos";
import { categorias, criterios, cubiertas, franjas, modalidades, niveles, type Pesos } from "../../../_motor";
import { confirmar, decidir, redactarConIA } from "../../../acciones";

export default async function Recomendacion({ params, searchParams }: PageProps<"/austral/matching/recomendacion/[personaId]/[proyectoId]">) {
  await requireRol(); // solo admin
  const { personaId, proyectoId } = await params;
  const { ok, error } = await searchParams;
  const datos = await cargarMatching(await createClient());
  const r = datos.resultados.find((x) => x.alumno.id === personaId && x.proyecto.id === proyectoId);
  const decision = datos.decisionDe(personaId, proyectoId);
  const alumno = r?.alumno ?? datos.sinGrupo.find((a) => a.id === personaId);
  const proyecto = datos.todosLosProyectos.find((p) => p.id === proyectoId);
  if (proyecto && !alumno && decision?.estado === "confirmada") {
    return (
      <div className="mx-auto max-w-5xl">
        <Encabezado titulo={proyecto.nombre} actual="/austral/matching" ok={ok} error={error} />
        <p className="mt-6 border p-4 text-sm">
          Esta asignación ya está confirmada: el alumno es integrante de {proyecto.nombre}
          {decision.puntaje !== null ? ` (compatibilidad al decidir: ${decision.puntaje}%)` : ""}.
          {decision.observaciones ? ` Observaciones: ${decision.observaciones}` : ""}
        </p>
        {decision.justificacion && <p className="mt-4 text-sm leading-relaxed text-[#666]">{decision.justificacion}</p>}
      </div>
    );
  }
  if (!alumno || !proyecto) notFound();
  const perfil = datos.perfilDe.get(personaId);
  const ya = cubiertas(proyecto.proyecto);
  const volver = `/austral/matching/recomendacion/${personaId}/${proyectoId}`;

  const otrosCandidatos = datos.resultados.filter((x) => x.proyecto.id === proyectoId && x.alumno.id !== personaId).sort((a, b) => b.puntaje - a.puntaje).slice(0, 3);
  const otrosProyectos = datos.resultados.filter((x) => x.alumno.id === personaId && x.proyecto.id !== proyectoId).sort((a, b) => b.puntaje - a.puntaje).slice(0, 3);
  const temas = [...alumno.intereses].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([t, e]) => `${datos.temas.get(t)} (${e}★)`);

  return (
    <div className="mx-auto max-w-5xl">
      <Encabezado titulo={`${alumno.nombre} → ${proyecto.nombre}`} actual="/austral/matching" ok={ok} error={error} />

      {!r && (
        <p className="mt-6 border p-3 text-sm">
          Esta combinación ya no está entre las recomendaciones: el proyecto no busca más integrantes o el alumno tiene otra propuesta en curso o ya está en un equipo.
        </p>
      )}

      {r && (
        <section className="mt-6 grid gap-6 border p-6 md:grid-cols-[12rem_1fr]">
          <div>
            <div className="font-serif text-5xl">{r.puntaje}%</div>
            <div className="text-sm text-[#666]">compatibilidad</div>
            {datos.plan.has(`${personaId}:${proyectoId}`) && <Badge className="mt-3">Sugerido por el agente</Badge>}
            {r.puntaje < datos.config.puntaje_minimo && <p className="mt-3 text-xs text-destructive">Por debajo del puntaje mínimo ({datos.config.puntaje_minimo}).</p>}
          </div>
          <div className="space-y-2">
            {(Object.keys(criterios) as (keyof Pesos)[]).map((k) => {
              const v = r.valores[k];
              return (
                <div key={k} className="grid grid-cols-[10rem_1fr_6rem] items-center gap-3 text-sm">
                  <span>{criterios[k]} <span className="text-[#666]">· {datos.pesos[k]}%</span></span>
                  <span className="h-2 bg-muted"><span className="block h-2 bg-primary" style={{ width: `${(v ?? 0) * 100}%` }} /></span>
                  <span className="text-right text-[#666]">{v === null ? "sin datos" : `${Math.round(v * 100)}/100`}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {r && (
        <section className="mt-6">
          <h2 className="mb-2 font-serif text-xl">Por qué</h2>
          <p className="leading-relaxed">{r.justificacion}</p>
          {r.alertas.length > 0 && (
            <ul className="mt-3 space-y-1 border border-destructive p-3 text-sm">
              {r.alertas.map((a, i) => <li key={i}>⚠ {a}</li>)}
            </ul>
          )}
          {decision?.justificacion_ia && (
            <div className="mt-4 border p-4 text-sm">
              <div className="mb-1 text-[#666]">Redactado con IA a partir de los mismos datos</div>
              <p className="whitespace-pre-line leading-relaxed">{decision.justificacion_ia}</p>
            </div>
          )}
          {hayIA() && (
            <form action={redactarConIA} className="mt-3">
              <input type="hidden" name="persona_id" value={personaId} />
              <input type="hidden" name="proyecto_id" value={proyectoId} />
              <input type="hidden" name="volver" value={volver} />
              <BotonEnviar variant="outline" enviando="Redactando…">{decision?.justificacion_ia ? "Volver a redactar con IA" : "Redactar con IA"}</BotonEnviar>
            </form>
          )}
        </section>
      )}

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="border p-5 text-sm">
          <h2 className="mb-3 font-serif text-lg">{alumno.nombre}</h2>
          <dl className="space-y-1">
            <div><dt className="inline text-[#666]">Carrera: </dt><dd className="inline">{alumno.carrera ?? "sin dato"}{alumno.anio ? ` · ${alumno.anio}º año` : ""}</dd></div>
            <div><dt className="inline text-[#666]">Habilidades: </dt><dd className="inline">{alumno.habilidades.map((h) => `${h.nombre} (${niveles[h.nivel].toLowerCase()})`).join(", ") || "sin cargar"}</dd></div>
            <div><dt className="inline text-[#666]">Intereses: </dt><dd className="inline">{temas.join(", ") || "sin cargar"}</dd></div>
            <div><dt className="inline text-[#666]">Disponibilidad: </dt><dd className="inline">{alumno.disponibilidad.map((f) => franjas[f]).join(", ") || "sin dato"}{alumno.modalidad ? ` · ${modalidades[alumno.modalidad]}` : ""}</dd></div>
            {perfil?.experiencia && <div><dt className="inline text-[#666]">Experiencia: </dt><dd className="inline">{perfil.experiencia}</dd></div>}
            {perfil?.preferencias && <div><dt className="inline text-[#666]">Preferencias: </dt><dd className="inline">{perfil.preferencias}</dd></div>}
          </dl>
          <Link href={`/austral/matching/alumnos/${personaId}`} className="mt-3 inline-block underline underline-offset-4">Editar perfil</Link>
        </section>
        <section className="border p-5 text-sm">
          <h2 className="mb-3 font-serif text-lg">{proyecto.nombre}</h2>
          <dl className="space-y-1">
            <div><dt className="inline text-[#666]">Integrantes: </dt><dd className="inline">{proyecto.proyecto.integrantes.length}{proyecto.necesidad ? ` de ${proyecto.necesidad.integrantes_necesarios}` : ""} · {proyecto.proyecto.vacantes} lugar(es) libre(s)</dd></div>
            <div><dt className="inline text-[#666]">Ya cubre: </dt><dd className="inline">{proyecto.proyecto.buscadas.filter((h) => ya.has(h.id)).map((h) => h.nombre).join(", ") || "—"}</dd></div>
            <div><dt className="inline text-[#666]">Le falta: </dt><dd className="inline">{proyecto.proyecto.buscadas.filter((h) => !ya.has(h.id)).map((h) => h.nombre).join(", ") || "—"}</dd></div>
            <div><dt className="inline text-[#666]">Perfiles del equipo: </dt><dd className="inline">{proyecto.proyecto.integrantes.map((i) => `${i.nombre} (${[...new Set(i.habilidades.map((h) => categorias[h.categoria]))].join(", ") || "sin datos"})`).join("; ") || "—"}</dd></div>
            <div><dt className="inline text-[#666]">Disponibilidad: </dt><dd className="inline">{proyecto.proyecto.disponibilidad.map((f) => franjas[f]).join(", ") || "sin dato"}{proyecto.proyecto.modalidad ? ` · ${modalidades[proyecto.proyecto.modalidad]}` : ""}</dd></div>
          </dl>
          <Link href={`/austral/matching/proyectos/${proyectoId}`} className="mt-3 inline-block underline underline-offset-4">Editar necesidades</Link>
        </section>
      </div>

      {(otrosCandidatos.length > 0 || otrosProyectos.length > 0) && (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <section>
            <h2 className="mb-2 text-sm font-medium">Otros candidatos para {proyecto.nombre}</h2>
            <ul className="divide-y border text-sm">
              {otrosCandidatos.map((x) => (
                <li key={x.alumno.id} className="flex justify-between gap-3 p-3">
                  <Link href={`/austral/matching/recomendacion/${x.alumno.id}/${proyectoId}`} className="underline underline-offset-4">{x.alumno.nombre}</Link>
                  <span className="text-[#666]">{x.puntaje}% · {x.aporte ?? "—"}</span>
                </li>
              ))}
              {otrosCandidatos.length === 0 && <li className="p-3 text-[#666]">No hay otros candidatos.</li>}
            </ul>
          </section>
          <section>
            <h2 className="mb-2 text-sm font-medium">Otros proyectos para {alumno.nombre}</h2>
            <ul className="divide-y border text-sm">
              {otrosProyectos.map((x) => (
                <li key={x.proyecto.id} className="flex justify-between gap-3 p-3">
                  <Link href={`/austral/matching/recomendacion/${personaId}/${x.proyecto.id}`} className="underline underline-offset-4">{x.proyecto.nombre}</Link>
                  <span className="text-[#666]">{x.puntaje}%</span>
                </li>
              ))}
              {otrosProyectos.length === 0 && <li className="p-3 text-[#666]">No hay otros proyectos buscando integrantes.</li>}
            </ul>
          </section>
        </div>
      )}

      <section className="mt-10 border-t pt-6">
        <div className="flex items-center gap-3">
          <h2 className="font-serif text-xl">Decisión</h2>
          {decision && <Badge variant={claseEstado[decision.estado].variante}>{claseEstado[decision.estado].texto}</Badge>}
        </div>
        {decision?.estado === "confirmada" ? (
          <p className="mt-3 text-sm">El alumno ya es integrante del proyecto.{decision.observaciones ? ` Observaciones: ${decision.observaciones}` : ""}</p>
        ) : (
          <>
            <form action={decidir} className="mt-4 space-y-4">
              <input type="hidden" name="persona_id" value={personaId} />
              <input type="hidden" name="proyecto_id" value={proyectoId} />
              <input type="hidden" name="volver" value={volver} />
              <div className="flex flex-wrap gap-6 text-sm">
                {([["aceptada", "Aceptar (crear propuesta)"], ["pendiente", "Dejar pendiente"], ["rechazada", "Rechazar"]] as const).map(([v, t]) => (
                  <label key={v} className="flex items-center gap-2">
                    <input type="radio" name="decision" value={v} defaultChecked={(decision?.estado ?? "pendiente") === v} disabled={v === "aceptada" && !r} /> {t}
                  </label>
                ))}
              </div>
              <div>
                <Label htmlFor="observaciones">Observaciones</Label>
                <textarea id="observaciones" name="observaciones" rows={2} defaultValue={decision?.observaciones ?? ""} className={campoClase} />
              </div>
              <BotonEnviar variant="outline" enviando="Guardando…">Guardar decisión</BotonEnviar>
            </form>
            {decision?.estado === "aceptada" && (
              <form action={confirmar} className="mt-4 border p-4">
                <input type="hidden" name="recomendacion_id" value={decision.id} />
                <input type="hidden" name="volver" value={volver} />
                <p className="mb-3 text-sm">La propuesta está aceptada. Al confirmarla, {alumno.nombre} pasa a ser integrante de {proyecto.nombre}.</p>
                <BotonEnviar enviando="Confirmando…">Confirmar asignación</BotonEnviar>
              </form>
            )}
          </>
        )}
      </section>
    </div>
  );
}
