// GRUPO AUSTRAL — resumen del matching (solo admin): indicadores, alertas pendientes, una tarjeta por proyecto con sus
// integrantes, gráficos y métricas de seguimiento.
import Link from "next/link";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Barras } from "../_components/barras";
import { Encabezado } from "../_components/encabezado";
import { cargarMatching, estadosBusqueda } from "../_datos";
import { calcularMetricas } from "../_metricas";

const porcentaje = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);
const uno = (x: number | null, sufijo = "") => (x === null ? "—" : `${x.toFixed(1).replace(".", ",")}${sufijo}`);

function Indicador({ valor, texto, detalle }: { valor: string | number; texto: string; detalle?: string }) {
  return (
    <div className="border-r border-b p-4">
      <div className="font-serif text-3xl">{valor}</div>
      <div className="text-sm">{texto}</div>
      {detalle && <div className="mt-1 text-xs text-[#666]">{detalle}</div>}
    </div>
  );
}

function Grafico({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="border p-5">
      <h2 className="mb-4 text-sm font-medium">{titulo}</h2>
      {children}
    </section>
  );
}

export default async function Resumen({ searchParams }: PageProps<"/austral/matching/resumen">) {
  await requireRol(); // solo admin
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  const datos = await cargarMatching(supabase);
  const { indicadores: i, graficos: g, seguimiento: s } = await calcularMetricas(supabase, datos);

  return (
    <div className="mx-auto max-w-6xl">
      <Encabezado
        titulo="Resumen"
        descripcion="Cómo viene el armado de equipos: cuántos alumnos siguen sin grupo, qué se necesita y qué decidió el admin. Se actualiza con cada decisión."
        actual="/austral/matching/resumen"
        ok={ok}
        error={error}
      />

      <div className="mt-6 grid grid-cols-2 border-t border-l sm:grid-cols-3 lg:grid-cols-6">
        <Indicador valor={i.sinGrupo} texto="alumnos sin grupo" />
        <Indicador valor={i.buscando} texto="proyectos buscando" />
        <Indicador valor={i.matches} texto="matches generados" detalle={`sobre el puntaje mínimo (${datos.config.puntaje_minimo})`} />
        <Indicador valor={i.pendientes} texto="pendientes de validar" detalle="propuestas sin confirmar" />
        <Indicador valor={i.aceptados} texto="asignaciones confirmadas" />
        <Indicador valor={porcentaje(i.consiguieronEquipo)} texto="consiguieron equipo" detalle="de los que pasaron por el matching" />
      </div>

      {datos.alertas.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-serif text-xl">Alertas pendientes ({datos.alertas.length})</h2>
            <Link href="/austral/matching" className="text-sm underline underline-offset-4">Ver todas con su sugerencia</Link>
          </div>
          <ul className="divide-y border text-sm">
            {datos.alertas.slice(0, 5).map((a, k) => (
              <li key={k} className="flex flex-wrap justify-between gap-2 p-3">
                <span className="font-medium">{a.titulo}</span>
                <span className="text-[#666]">{a.accion}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 font-serif text-xl">Proyectos y sus integrantes</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {datos.todosLosProyectos.map((p) => {
            const propuestos = datos.decisiones.filter((d) => d.estado === "aceptada" && d.proyecto_id === p.id);
            return (
              <Link key={p.id} href={`/austral/matching/proyectos/${p.id}`} className="flex flex-col border p-4 hover:bg-card">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-serif text-lg">{p.nombre}</h3>
                  {p.necesidad && (
                    <Badge variant={p.necesidad.estado === "buscando" ? "default" : "outline"}>{estadosBusqueda[p.necesidad.estado]}</Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-[#666]">
                  {p.proyecto.integrantes.length}
                  {p.necesidad ? ` de ${p.necesidad.integrantes_necesarios} integrantes` : ` integrante${p.proyecto.integrantes.length === 1 ? "" : "s"} · sin necesidades cargadas`}
                  {p.necesidad && p.proyecto.vacantes > 0 ? ` · ${p.proyecto.vacantes} lugar${p.proyecto.vacantes === 1 ? "" : "es"} libre${p.proyecto.vacantes === 1 ? "" : "s"}` : ""}
                </p>
                <ul className="mt-3 space-y-1 text-sm">
                  {p.proyecto.integrantes.map((i, k) => (
                    <li key={k}>{i.nombre}{i.carrera && <span className="text-[#666]"> · {i.carrera}</span>}</li>
                  ))}
                  {propuestos.map((d) => (
                    <li key={d.id} className="text-[#666]">{datos.nombreAlumno(d.persona_id)} · propuesto, falta confirmar</li>
                  ))}
                  {p.proyecto.integrantes.length === 0 && !propuestos.length && <li className="text-[#666]">Todavía no tiene integrantes.</li>}
                </ul>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Grafico titulo="Alumnos sin grupo por carrera"><Barras filas={g.carreras} unidad="alumnos" vacio="No hay alumnos sin grupo." /></Grafico>
        <Grafico titulo="Estado de las recomendaciones"><Barras filas={g.estados} unidad="decisiones" vacio="Todavía no hay decisiones." /></Grafico>
        <Grafico titulo="Habilidades disponibles (alumnos sin grupo)"><Barras filas={g.habilidadesDisponibles} unidad="alumnos" /></Grafico>
        <Grafico titulo="Habilidades más demandadas (lo que les falta a los equipos)"><Barras filas={g.habilidadesDemandadas} unidad="proyectos" vacio="Ningún proyecto tiene habilidades sin cubrir." /></Grafico>
        <Grafico titulo="Categorías disponibles (alumnos sin grupo con al menos una habilidad)"><Barras filas={g.categoriasDisponibles} unidad="alumnos" /></Grafico>
        <Grafico titulo="Proyectos con más lugares libres"><Barras filas={g.necesidadProyectos} unidad="lugares" vacio="Ningún proyecto busca integrantes." /></Grafico>
      </div>

      <section className="mt-10">
        <h2 className="font-serif text-xl">Seguimiento</h2>
        <p className="mt-1 mb-4 text-sm text-[#666]">Métricas de éxito del agente. La satisfacción se registra en cada asignación confirmada.</p>
        <div className="grid grid-cols-2 border-t border-l sm:grid-cols-3 lg:grid-cols-5">
          <Indicador valor={porcentaje(i.consiguieronEquipo)} texto="se incorporaron a un equipo" detalle={`${s.incorporados} alumno${s.incorporados === 1 ? "" : "s"}`} />
          <Indicador valor={porcentaje(s.tasaAceptacion)} texto="recomendaciones aceptadas" detalle={`de ${s.decididas} decididas`} />
          <Indicador valor={uno(s.diasPromedio, " días")} texto="tiempo promedio hasta tener grupo" detalle="desde el alta del alumno en la app" />
          <Indicador valor={s.respuestas ? `${uno(s.satisfaccionAlumno)} / ${uno(s.satisfaccionEquipo)}` : "—"} texto="satisfacción alumno / equipo" detalle={`sobre 5 · ${s.respuestas} respuesta${s.respuestas === 1 ? "" : "s"}`} />
          <Indicador valor={s.equilibrioPromedio === null ? "—" : Math.round(s.equilibrioPromedio)} texto="equilibrio promedio de los equipos" detalle="100 = diseño, tecnología, negocios y operaciones parejos" />
        </div>
        {s.equipos.length > 0 && (
          <div className="mt-6">
            <Grafico titulo="Equilibrio de habilidades por equipo (de menor a mayor)"><Barras filas={s.equipos} unidad="puntos de equilibrio" /></Grafico>
          </div>
        )}
        {s.confirmadas.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-medium">Asignaciones confirmadas</h3>
            <ul className="divide-y border text-sm">
              {s.confirmadas.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <span>{datos.nombreAlumno(d.persona_id)} → {datos.todosLosProyectos.find((p) => p.id === d.proyecto_id)?.nombre}</span>
                  <span className="flex items-center gap-4">
                    <span className="text-[#666]">
                      {d.satisfaccion ? `Alumno ${d.satisfaccion.alumno ?? "—"}/5 · Equipo ${d.satisfaccion.equipo ?? "—"}/5` : "Sin satisfacción registrada"}
                    </span>
                    <Link href={`/austral/matching/recomendacion/${d.persona_id}/${d.proyecto_id}`} className="underline underline-offset-4">
                      {d.satisfaccion ? "Ver" : "Registrar"}
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
