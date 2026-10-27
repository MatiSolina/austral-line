// GRUPO JURADO — tablero de deliberación: suma sola los puntajes de todos los jurados y junta su feedback.
import Link from "next/link";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { estadosEvaluables, promedio } from "../_lib";
import { conEvento, elegirEvento, eventosVisibles, salonDelJurado } from "../_eventos";
import { fechaHora } from "../comunicaciones/plantillas";

const formato = (n: number | undefined) => (n === undefined ? "—" : n.toFixed(1));

// Se delibera por salón: cada salón tiene sus propios jurados, así que los rankings no mezclan salones.
export default async function Deliberacion({ searchParams }: PageProps<"/jurado/deliberacion">) {
  const persona = await requireRol("jurado");
  const esJurado = persona.rol === "jurado";
  const { evento: eventoParam, salon: salonParam } = await searchParams;
  const supabase = await createClient();
  const eventos = await eventosVisibles(supabase, persona);
  const evento = elegirEvento(eventos, eventoParam);

  // Salón a mostrar: el del jurado; el admin elige entre todos los del evento.
  const { data: salones, error: errorSalones } = evento
    ? await supabase.from("jurado_salones").select("id, evento_id, nombre, jurado_salon_proyectos(proyecto_id), jurado_salon_jurados(jurado_id)").eq("evento_id", evento.id).order("orden")
    : { data: [], error: null };
  if (errorSalones) throw errorSalones;
  const delJurado = evento && esJurado ? await salonDelJurado(supabase, evento.id, persona.id) : null;
  const salon = esJurado
    ? salones.find((s) => s.id === delJurado?.id)
    : (salones.find((s) => s.id === salonParam) ?? salones[0]);
  const ids = salon?.jurado_salon_proyectos.map((p) => p.proyecto_id) ?? [];

  const [proyectos, criterios, evaluaciones] = await Promise.all([
    supabase.from("proyectos").select("id, nombre, estado, jurado_fichas(propuesta_valor)").in("id", ids).in("estado", estadosEvaluables),
    supabase.from("jurado_criterios").select("id, nombre").order("orden"),
    // Solo las notas de este evento: las de otros eventos (o sin evento) no se mezclan.
    salon
      ? supabase
        .from("jurado_evaluaciones")
        .select("id, proyecto_id, jurado_id, propuesta_valor, comentarios, personas(nombre), jurado_puntajes(criterio_id, puntaje)")
        .eq("evento_id", salon.evento_id)
        .in("proyecto_id", ids)
        .order("updated_at")
      : null,
  ]);
  const notas = evaluaciones?.data ?? [];
  if (proyectos.error) throw proyectos.error;
  if (criterios.error) throw criterios.error;
  if (evaluaciones?.error) throw evaluaciones.error;
  const juradosDelSalon = salon?.jurado_salon_jurados.length ?? 0;

  const ranking = proyectos.data
    .map((p) => {
      const evs = notas.filter((e) => e.proyecto_id === p.id);
      const puntajes = evs.flatMap((e) => e.jurado_puntajes);
      return {
        ...p,
        evaluaciones: evs,
        general: promedio(puntajes.map((x) => x.puntaje)),
        porCriterio: new Map(criterios.data.map((c) => [
          c.id,
          promedio(puntajes.filter((x) => x.criterio_id === c.id).map((x) => x.puntaje)),
        ])),
      };
    })
    .sort((a, b) => (b.general ?? -1) - (a.general ?? -1) || a.nombre.localeCompare(b.nombre));

  return (
    <>
      <Link href={conEvento("/jurado", evento?.id)} className="text-sm text-[#666] hover:text-primary">← Evaluar proyectos</Link>
      <div className="mt-6 mb-8">
        <h1 className="font-serif text-2xl">Deliberación</h1>
        <p className="mt-1 text-sm text-[#666]">
          Promedio de los jurados del salón en este evento, de 1 a 10. Se actualiza cada vez que alguien guarda o ajusta su evaluación.
        </p>
      </div>

      {evento && (eventos.length > 1 || (!esJurado && salones.length > 1)) && (
        <form className="mb-8 flex flex-wrap items-end gap-3">
          <div className="grid gap-2">
            <Label htmlFor="evento">Evento</Label>
            <select id="evento" name="evento" defaultValue={evento.id} className="h-9 min-w-64 border bg-background px-2 text-sm">
              {eventos.map((e) => <option key={e.id} value={e.id}>{e.nombre} · {fechaHora(e.inicio)}</option>)}
            </select>
          </div>
          {!esJurado && salones.length > 1 && (
            <div className="grid gap-2">
              <Label htmlFor="salon">Salón</Label>
              <select id="salon" name="salon" defaultValue={salon?.id} className="h-9 min-w-40 border bg-background px-2 text-sm">
                {salones.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
          )}
          <Button type="submit" variant="outline" size="lg">Ver</Button>
        </form>
      )}

      {evento && salon && <p className="mb-6 text-sm"><span className="font-medium">{evento.nombre}</span><span className="text-[#666]"> · {salon.nombre}</span></p>}

      {!evento || !salon ? (
        <div className="border p-10 text-center text-sm text-[#666]">
          {!evento
            ? (esJurado ? "Todavía no te asignaron a un salón." : "No hay eventos cargados.")
            : esJurado ? "No tenés salón asignado en este evento." : "Este evento todavía no tiene salones. Se arman desde Salones."}
        </div>
      ) : ranking.length === 0 ? (
        <div className="border p-10 text-center text-sm text-[#666]">Este salón todavía no tiene equipos asignados.</div>
      ) : (
        <>
          <Table className="mb-14">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Proyecto</TableHead>
                {criterios.data.map((c) => <TableHead key={c.id} className="text-right">{c.nombre}</TableHead>)}
                <TableHead className="text-right">Jurados</TableHead>
                <TableHead className="text-right">Promedio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranking.map((p, i) => (
                <TableRow key={p.id}>
                  <TableCell className="text-[#666]">{p.general === undefined ? "" : i + 1}</TableCell>
                  <TableCell>
                    <a href={`#${p.id}`} className="font-medium hover:text-primary">{p.nombre}</a>
                  </TableCell>
                  {criterios.data.map((c) => (
                    <TableCell key={c.id} className="text-right text-[#666]">{formato(p.porCriterio.get(c.id))}</TableCell>
                  ))}
                  <TableCell className="text-right text-[#666]">{p.evaluaciones.length}/{juradosDelSalon}</TableCell>
                  <TableCell className="text-right font-serif text-2xl">{formato(p.general)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="grid gap-14">
            {ranking.map((p) => (
              <section key={p.id} id={p.id} className="scroll-mt-6">
                <div className="mb-4 flex items-baseline justify-between gap-4 border-b pb-3">
                  <h2 className="font-serif text-xl">{p.nombre} <Badge variant="outline" className="ml-2 align-middle capitalize">{p.estado}</Badge></h2>
                  <span className="font-serif text-xl">{formato(p.general)}</span>
                </div>
                {p.jurado_fichas?.propuesta_valor && (
                  <div className="mb-4 border-l-2 border-primary pl-4">
                    <p className="text-xs text-[#666]">Propuesta de valor oficial del equipo</p>
                    <p className="mt-1">{p.jurado_fichas.propuesta_valor}</p>
                  </div>
                )}
                {p.evaluaciones.length === 0 ? (
                  <p className="text-sm text-[#666]">Ningún jurado lo evaluó todavía.</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {p.evaluaciones.map((e) => (
                      <article key={e.id} className="border bg-card p-5">
                        <div className="mb-4 flex items-baseline justify-between gap-4">
                          <span className="font-medium">
                            {e.personas.nombre}
                            {e.jurado_id === persona.id && <span className="ml-2 text-xs text-[#666]">(vos)</span>}
                          </span>
                          <span className="font-serif text-lg">{formato(promedio(e.jurado_puntajes.map((x) => x.puntaje)))}</span>
                        </div>
                        <dl className="grid gap-3 text-sm">
                          <div>
                            <dt className="text-xs text-[#666]">Propuesta de valor, según este jurado</dt>
                            <dd className="mt-1">{e.propuesta_valor ?? <span className="text-[#666]">Sin completar</span>}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-[#666]">Comentarios para el equipo</dt>
                            <dd className="mt-1 whitespace-pre-line">{e.comentarios ?? <span className="text-[#666]">Sin completar</span>}</dd>
                          </div>
                        </dl>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}
