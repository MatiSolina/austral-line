// GRUPO JURADO — "Mi devolución": cada alumno ve las devoluciones publicadas de su equipo.
// La base solo le deja leer las de su equipo y ya publicadas; acá no hay nombres de jurados ni ranking.
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fechaHora } from "../comunicaciones/plantillas";

const formato = (n: number | null) => (n == null ? "—" : Number(n).toFixed(1));
type Promedio = { criterio: string; promedio: number | null };

export default async function MiDevolucion() {
  const persona = await requireRol("alumno");
  if (persona.rol === "admin") {
    // El admin puede leer todas las devoluciones (también las no publicadas): no se las mostramos acá como si fuera un alumno.
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="font-serif text-2xl">Mi devolución</h1>
        <div className="mt-10 border p-10 text-center text-sm text-[#666]">
          Esta es la pantalla de los alumnos: cada uno ve acá solo las devoluciones publicadas de su equipo. Las del admin están en Jurado → Devoluciones.
        </div>
      </div>
    );
  }
  const supabase = await createClient();
  const [devoluciones, publicaciones] = await Promise.all([
    supabase
      .from("jurado_devoluciones")
      .select("evento_id, proyecto_id, comentarios, propuestas, promedio_general, promedios, evaluaciones, actualizada_at, eventos(nombre, inicio), proyectos(nombre)"),
    supabase.from("jurado_publicaciones").select("evento_id, publicada_at"),
  ]);
  if (devoluciones.error) throw devoluciones.error;
  if (publicaciones.error) throw publicaciones.error;
  const publicadaEl = new Map(publicaciones.data.map((p) => [p.evento_id, p.publicada_at]));
  // La base ya filtra por equipo y publicación; este filtro es una segunda red.
  const lista = devoluciones.data.filter((d) => publicadaEl.has(d.evento_id)).sort((a, b) => b.eventos.inicio.localeCompare(a.eventos.inicio));

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-serif text-2xl">Mi devolución</h1>
      <p className="mt-1 mb-10 text-sm text-[#666]">Lo que el jurado opinó de tu equipo en cada instancia.</p>

      {lista.length === 0 ? (
        <div className="border p-10 text-center text-sm text-[#666]">
          Todavía no hay devoluciones publicadas para tu equipo. Cuando el jurado las publique, aparecen acá.
        </div>
      ) : (
        <div className="grid gap-16">
          {lista.map((d) => {
            const promedios = d.promedios as Promedio[];
            const propuestas = d.propuestas.filter(Boolean);
            const comentarios = d.comentarios.filter(Boolean);
            return (
              <article key={`${d.evento_id}-${d.proyecto_id}`}>
                <header className="mb-6 border-b pb-6">
                  <p className="text-sm text-[#666]">{d.eventos.nombre}</p>
                  <div className="mt-1 flex items-baseline justify-between gap-4">
                    <h2 className="font-serif text-3xl">{d.proyectos.nombre}</h2>
                    <span className="font-serif text-5xl">{formato(d.promedio_general)}</span>
                  </div>
                  <p className="mt-2 text-xs text-[#666]">
                    {publicadaEl.has(d.evento_id) && `Publicada el ${fechaHora(publicadaEl.get(d.evento_id)!)}`}
                    {d.actualizada_at && ` · Actualizada el ${fechaHora(d.actualizada_at)}`}
                    {` · Promedio de ${d.evaluaciones} ${d.evaluaciones === 1 ? "jurado" : "jurados"}, de 1 a 10`}
                  </p>
                </header>

                <dl className="mb-10 grid grid-cols-2 gap-px border bg-border sm:grid-cols-4">
                  {promedios.map((p) => (
                    <div key={p.criterio} className="bg-background p-4">
                      <dt className="text-xs text-[#666]">{p.criterio}</dt>
                      <dd className="mt-1 font-serif text-2xl">{formato(p.promedio)}</dd>
                    </div>
                  ))}
                </dl>

                {propuestas.length > 0 && (
                  <section className="mb-10">
                    <h3 className="mb-3 font-serif text-xl">Cómo entendieron su propuesta de valor</h3>
                    <ul className="grid gap-3">
                      {propuestas.map((t, i) => <li key={i} className="border-l-2 border-primary pl-4">{t}</li>)}
                    </ul>
                  </section>
                )}

                <section>
                  <h3 className="mb-3 font-serif text-xl">Comentarios del jurado</h3>
                  {comentarios.length === 0 ? (
                    <p className="text-sm text-[#666]">El jurado no dejó comentarios escritos.</p>
                  ) : (
                    <ul className="grid gap-3">
                      {comentarios.map((t, i) => <li key={i} className="whitespace-pre-line border bg-card p-4">{t}</li>)}
                    </ul>
                  )}
                </section>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
