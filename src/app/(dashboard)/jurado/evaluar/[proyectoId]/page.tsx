// GRUPO JURADO — planilla de evaluación de un proyecto, pensada para usar en tablet durante el pitch.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { estadosEvaluables } from "../../_lib";
import { conEvento, salonDelJurado } from "../../_eventos";
import { FichaProyecto } from "../../_components/ficha-proyecto";

const escala = Array.from({ length: 10 }, (_, i) => i + 1);

async function guardarEvaluacion(formData: FormData) {
  "use server";
  const persona = await requireRol("jurado");
  if (persona.rol !== "jurado") throw new Error("Solo los jurados cargan notas.");
  const proyectoId = String(formData.get("proyecto_id"));
  const eventoId = String(formData.get("evento_id"));
  const texto = (campo: string) => String(formData.get(campo) ?? "").trim() || null;

  const supabase = await createClient();
  const { data: proyecto, error: errorProyecto } = await supabase.from("proyectos").select("estado").eq("id", proyectoId).maybeSingle();
  if (errorProyecto) throw errorProyecto;
  if (!proyecto || !estadosEvaluables.includes(proyecto.estado)) throw new Error("Este proyecto todavía no se puede evaluar.");

  const { data: criterios, error: errorCriterios } = await supabase.from("jurado_criterios").select("id");
  if (errorCriterios) throw errorCriterios;
  const puntajes = criterios.map((c) => ({ criterio_id: c.id, puntaje: Number(formData.get(`criterio_${c.id}`)) }));
  if (puntajes.some((p) => !Number.isInteger(p.puntaje) || p.puntaje < 1 || p.puntaje > 10)) {
    throw new Error("Falta puntuar algún criterio (de 1 a 10).");
  }

  const salon = await salonDelJurado(supabase, eventoId, persona.id);
  if (!salon?.proyectos.includes(proyectoId)) throw new Error("Este equipo no está en tu salón para este evento.");

  // Insertar o actualizar a mano (no upsert): así nunca se pisa una evaluación de otro evento.
  const { data: existente, error: errorExistente } = await supabase
    .from("jurado_evaluaciones").select("id, evento_id").eq("proyecto_id", proyectoId).eq("jurado_id", persona.id).maybeSingle();
  if (errorExistente) throw errorExistente;
  if (existente && existente.evento_id !== eventoId) throw new Error("Ya evaluaste a este equipo en otro evento.");

  const datos = { propuesta_valor: texto("propuesta_valor"), comentarios: texto("comentarios"), updated_at: new Date().toISOString() };
  const { data: evaluacion, error } = existente
    ? await supabase.from("jurado_evaluaciones").update(datos).eq("id", existente.id).select("id").single()
    : await supabase.from("jurado_evaluaciones")
      .insert({ ...datos, proyecto_id: proyectoId, jurado_id: persona.id, evento_id: eventoId }).select("id").single();
  if (error) throw error;

  const { error: errorPuntajes } = await supabase
    .from("jurado_puntajes")
    .upsert(puntajes.map((p) => ({ ...p, evaluacion_id: evaluacion.id })));
  if (errorPuntajes) throw errorPuntajes;

  revalidatePath("/jurado", "layout");
  redirect(conEvento("/jurado", eventoId));
}

export default async function EvaluarProyecto({ params, searchParams }: PageProps<"/jurado/evaluar/[proyectoId]">) {
  const { proyectoId } = await params;
  const { evento: eventoParam } = await searchParams;
  const persona = await requireRol("jurado");
  const supabase = await createClient();

  const { data: proyecto, error } = await supabase
    .from("proyectos")
    .select("id, nombre, descripcion, estado, proyecto_integrantes(personas(nombre)), jurado_fichas(*)")
    .eq("id", proyectoId)
    .maybeSingle();
  if (error?.code === "22P02") notFound(); // id con formato inválido
  if (error) throw error;
  if (!proyecto) notFound();

  const { data: evento } = typeof eventoParam === "string"
    ? await supabase.from("eventos").select("id, nombre").eq("id", eventoParam).maybeSingle()
    : { data: null };
  const volver = conEvento("/jurado", evento?.id);
  // El jurado evalúa solo a los equipos de su salón en ese evento (la base también lo impide).
  const salon = evento && persona.rol === "jurado" ? await salonDelJurado(supabase, evento.id, persona.id) : null;
  const enSuSalon = persona.rol !== "jurado" || !!salon?.proyectos.includes(proyecto.id);

  if (!evento || !enSuSalon) {
    return (
      <div className="mx-auto max-w-3xl">
        <Link href={volver} className="text-sm text-[#666] hover:text-primary">← Todos los proyectos</Link>
        <div className="mt-6 border p-10 text-center">
          <h1 className="font-serif text-2xl">{proyecto.nombre}</h1>
          <p className="mt-2 text-sm text-[#666]">
            {!evento ? "Elegí el evento desde la planilla para evaluar a este equipo." : "Este equipo no está en tu salón para este evento."}
          </p>
        </div>
      </div>
    );
  }

  if (!estadosEvaluables.includes(proyecto.estado)) {
    return (
      <div className="mx-auto max-w-3xl">
        <Link href={volver} className="text-sm text-[#666] hover:text-primary">← Todos los proyectos</Link>
        <div className="mt-6 border p-10 text-center">
          <h1 className="font-serif text-2xl">{proyecto.nombre}</h1>
          <p className="mt-2 text-sm text-[#666]">Este proyecto está en borrador: todavía no se puede evaluar.</p>
        </div>
      </div>
    );
  }

  // El admin puede mirar la planilla, pero las notas las cargan solo los jurados.
  // Y cuando se publican las devoluciones del evento, las notas quedan cerradas (la base también lo impide).
  const { data: publicacion } = await supabase.from("jurado_publicaciones").select("evento_id").eq("evento_id", evento.id).maybeSingle();
  const cerrado = !!publicacion;
  const soloLectura = persona.rol !== "jurado" || cerrado;

  const [criterios, evaluacion] = await Promise.all([
    supabase.from("jurado_criterios").select("id, nombre, descripcion").order("orden"),
    supabase
      .from("jurado_evaluaciones")
      .select("evento_id, propuesta_valor, comentarios, eventos(nombre), jurado_puntajes(criterio_id, puntaje)")
      .eq("proyecto_id", proyectoId)
      .eq("jurado_id", persona.id)
      .maybeSingle(),
  ]);
  if (criterios.error) throw criterios.error;
  if (evaluacion.error) throw evaluacion.error;

  // Hasta que el profe autorice una evaluación por evento, cada jurado tiene una sola por equipo:
  // si ya es de otro evento (o de antes de separar por evento), se muestra el aviso y no se pisa.
  const deOtroEvento = evaluacion.data && evaluacion.data.evento_id !== evento.id ? evaluacion.data : null;
  const actual = deOtroEvento ? null : evaluacion.data;
  const puntajeActual = new Map(actual?.jurado_puntajes.map((p) => [p.criterio_id, p.puntaje]));
  const integrantes = proyecto.proyecto_integrantes.map((i) => i.personas.nombre);

  if (deOtroEvento) {
    return (
      <div className="mx-auto max-w-3xl">
        <Link href={volver} className="text-sm text-[#666] hover:text-primary">← Todos los proyectos</Link>
        <div className="mt-6 border p-10 text-center">
          <h1 className="font-serif text-2xl">{proyecto.nombre}</h1>
          <p className="mt-2 text-sm text-[#666]">
            Ya evaluaste a este equipo {deOtroEvento.eventos ? `en ${deOtroEvento.eventos.nombre}` : "antes de que las notas se separaran por evento"}.
            Por ahora cada jurado puede evaluar a un mismo equipo una sola vez; evaluarlo en más de un evento está pendiente de habilitación.
            Tu evaluación anterior no se modificó.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={volver} className="text-sm text-[#666] hover:text-primary">← Todos los proyectos</Link>
      <p className="mt-6 text-sm text-[#666]">{evento.nombre}{salon && ` · ${salon.nombre}`}</p>

      <header className="mt-2 mb-10 border-b pb-8">
        <h1 className="font-serif text-3xl">{proyecto.nombre}</h1>
        {proyecto.descripcion && <p className="mt-2 text-[#666]">{proyecto.descripcion}</p>}
        {integrantes.length > 0 && <p className="mt-4 text-sm text-[#666]">Equipo: {integrantes.join(", ")}</p>}
        {proyecto.jurado_fichas && (
          <details className="group mt-6 border bg-card">
            <summary className="cursor-pointer list-none px-5 py-3 text-sm text-[#666] hover:text-primary">
              <span className="group-open:hidden">Ver ficha del proyecto</span>
              <span className="hidden group-open:inline">Ocultar ficha</span>
            </summary>
            <div className="border-t px-5 py-5"><FichaProyecto ficha={proyecto.jurado_fichas} /></div>
          </details>
        )}
      </header>

      {soloLectura && (
        <p className="mb-8 border-l-2 border-primary pl-4 text-sm text-[#666]">
          {cerrado
            ? "Las devoluciones de este evento ya se publicaron: las notas quedaron cerradas."
            : "Estás viendo la planilla como administrador. Las notas las cargan solo los jurados, así no se mezclan con el ranking."}
        </p>
      )}

      <form action={guardarEvaluacion}>
        <input type="hidden" name="proyecto_id" value={proyecto.id} />
        <input type="hidden" name="evento_id" value={evento.id} />
        <fieldset disabled={soloLectura} className="disabled:opacity-60">
          {criterios.data.map((c) => (
            <fieldset key={c.id} className="group border-b pb-8 mb-8">
              <legend className="font-medium">{c.nombre}</legend>
              {c.descripcion && <p className="mt-1 text-sm text-[#666]">{c.descripcion}</p>}
              <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-10">
                {escala.map((n) => (
                  <label key={n} className="relative cursor-pointer">
                    <input
                      type="radio"
                      name={`criterio_${c.id}`}
                      value={n}
                      required
                      defaultChecked={puntajeActual.get(c.id) === n}
                      aria-label={`${c.nombre}: ${n}`}
                      className="peer absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
                    />
                    <span className="flex h-12 items-center justify-center border font-serif text-lg text-[#666] transition-colors hover:border-primary hover:text-primary peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-user-invalid:border-destructive">
                      {n}
                    </span>
                  </label>
                ))}
              </div>
              {/* Aparece solo si el jurado intenta guardar sin puntuar este criterio. */}
              <p className="mt-2 hidden text-sm text-destructive group-has-[input:user-invalid]:block">Elegí un puntaje de 1 a 10.</p>
            </fieldset>
          ))}

          <div className="mb-8 grid gap-2">
            <Label htmlFor="propuesta_valor">¿Cuál es la propuesta de valor, en tus palabras?</Label>
            <p className="text-sm text-[#666]">Sirve para alinear criterios con el resto del jurado en la deliberación.</p>
            <textarea
              id="propuesta_valor"
              name="propuesta_valor"
              rows={3}
              defaultValue={actual?.propuesta_valor ?? ""}
              className="w-full border bg-transparent p-3 text-sm outline-none focus-visible:border-ring"
            />
          </div>

          <div className="mb-8 grid gap-2">
            <Label htmlFor="comentarios">Comentarios y feedback para el equipo</Label>
            <textarea
              id="comentarios"
              name="comentarios"
              rows={5}
              defaultValue={actual?.comentarios ?? ""}
              className="w-full border bg-transparent p-3 text-sm outline-none focus-visible:border-ring"
            />
          </div>
        </fieldset>

        {!soloLectura && (
          <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-background py-4">
            <Link href={volver} className="flex h-9 items-center px-3 text-sm text-[#666] hover:text-primary">Cancelar</Link>
            <Button type="submit" size="lg">{actual ? "Guardar cambios" : "Guardar evaluación"}</Button>
          </div>
        )}
      </form>
    </div>
  );
}
