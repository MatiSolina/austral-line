// GRUPO JURADO — "Resumen del pitch": lo que ve el jurado antes de la evaluación final. Los resúmenes aprobados de los
// equipos de su salón, para leer o escuchar (es opcional: cada uno elige). El admin ve la misma pantalla y elige el salón.
import Link from "next/link";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Escuchar } from "../_components/escuchar";
import { conEvento, elegirEvento, eventosVisibles, salonDelJurado } from "../_eventos";
import { fechaHora } from "../comunicaciones/plantillas";
import { duracion } from "../_resumenes";

export default async function ResumenPitch({ searchParams }: PageProps<"/jurado/resumen-pitch">) {
  const persona = await requireRol("jurado");
  const esJurado = persona.rol === "jurado";
  const { evento: eventoParam, salon: salonParam } = await searchParams;
  const supabase = await createClient();
  const eventos = await eventosVisibles(supabase, persona);
  const evento = elegirEvento(eventos, eventoParam);

  // Salón a mostrar: el del jurado; el admin elige entre todos los del evento.
  const { data: salones, error: errorSalones } = evento
    ? await supabase.from("jurado_salones").select("id, nombre, jurado_salon_proyectos(proyecto_id, proyectos(nombre))").eq("evento_id", evento.id).order("orden")
    : { data: [], error: null };
  if (errorSalones) throw errorSalones;
  const delJurado = evento && esJurado ? await salonDelJurado(supabase, evento.id, persona.id) : null;
  const salon = esJurado
    ? salones.find((s) => s.id === delJurado?.id)
    : (salones.find((s) => s.id === salonParam) ?? salones[0]);
  const equipos = (salon?.jurado_salon_proyectos ?? [])
    .map((sp) => ({ id: sp.proyecto_id, nombre: sp.proyectos.nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  // La base ya le muestra al jurado solo los aprobados de su salón; el filtro es para que el admin vea lo mismo.
  const { data: resumenes, error } = evento && equipos.length
    ? await supabase
      .from("jurado_resumenes")
      .select("proyecto_id, texto, palabras")
      .eq("evento_id", evento.id)
      .eq("estado", "aprobado")
      .in("proyecto_id", equipos.map((q) => q.id))
    : { data: [], error: null };
  if (error) throw error;
  const resumenDe = new Map(resumenes.map((r) => [r.proyecto_id, r]));
  const listos = equipos.filter((q) => resumenDe.has(q.id));
  const palabras = listos.reduce((total, q) => total + resumenDe.get(q.id)!.palabras, 0);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={conEvento("/jurado", evento?.id)} className="text-sm text-[#666] hover:text-primary">← Evaluar proyectos</Link>
      <h1 className="mt-6 font-serif text-2xl">Resumen del pitch</h1>
      <p className="mt-1 mb-8 text-sm text-[#666]">
        Un resumen de cada equipo de tu salón, armado con su presentación final y la sesión grabada del pitch, para que llegues
        informado a la evaluación. Podés leerlo o escucharlo. No incluye opiniones ni notas: eso lo decidís vos.
      </p>

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

      {!evento || !salon ? (
        <div className="border p-10 text-center text-sm text-[#666]">
          {!evento
            ? (esJurado ? "Todavía no te asignaron a un salón." : "No hay eventos cargados.")
            : esJurado ? "No tenés salón asignado en este evento." : "Este evento todavía no tiene salones. Se arman desde Salones."}
        </div>
      ) : equipos.length === 0 ? (
        <div className="border p-10 text-center text-sm text-[#666]">Este salón todavía no tiene equipos asignados.</div>
      ) : (
        <>
          <section className="mb-10 flex flex-wrap items-end justify-between gap-4 border bg-card p-6">
            <div>
              <p className="text-sm"><span className="font-medium">{evento.nombre}</span><span className="text-[#666]"> · {salon.nombre}</span></p>
              <p className="mt-1 text-sm text-[#666]">
                {listos.length === equipos.length
                  ? "Ya están todos los resúmenes."
                  : `${listos.length} de ${equipos.length} resúmenes disponibles. Los que faltan aparecen acá cuando estén listos.`}
              </p>
            </div>
            {palabras > 0 && (
              <p className="text-right">
                <span className="font-serif text-3xl">{duracion(palabras)}</span>
                <span className="block text-xs text-[#666]">para escuchar todo</span>
              </p>
            )}
          </section>

          <div className="grid gap-10">
            {equipos.map((q, i) => {
              const r = resumenDe.get(q.id);
              return (
                <article key={q.id} className="border-t pt-6">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="font-serif text-xl">
                      <span className="mr-2 text-[#666]">{i + 1}.</span>{q.nombre}
                    </h2>
                    {r?.texto && (
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-[#666]">{duracion(r.palabras)}</span>
                        <Escuchar texto={r.texto} />
                      </div>
                    )}
                  </div>
                  {r?.texto ? (
                    <p className="whitespace-pre-line text-sm leading-relaxed">{r.texto}</p>
                  ) : (
                    <p className="text-sm text-[#666]">Todavía no está disponible.</p>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
