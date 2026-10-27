// GRUPO JURADO — estado de las devoluciones de un evento (lo usan la lista, la revisión de cada equipo y las acciones).
import type { createClient } from "@/lib/supabase/server";
import { promedio } from "../_lib";
import { criteriosDelEvento } from "../_criterios";
import { evaluacionesBloqueadas, motivoBloqueo } from "../_eventos";

type Cliente = Awaited<ReturnType<typeof createClient>>;

export type Estado = "ausente" | "sin_evaluaciones" | "sin_revisar" | "desactualizada" | "lista";

export const estados: Record<Estado, { texto: string; bloquea: boolean }> = {
  ausente: { texto: "No se presentó", bloquea: false },
  sin_evaluaciones: { texto: "Sin evaluaciones", bloquea: true },
  sin_revisar: { texto: "Falta revisar", bloquea: true },
  desactualizada: { texto: "Cambiaron las evaluaciones: revisar de nuevo", bloquea: true },
  lista: { texto: "Revisada", bloquea: false },
};

// Textos únicos y en orden alfabético: así el orden no delata qué jurado escribió qué.
export const textosSinNombre = (textos: (string | null)[]) =>
  [...new Set(textos.map((t) => t?.replace(/\r\n/g, "\n").trim()).filter((t): t is string => !!t))].sort((a, b) => a.localeCompare(b, "es"));

// Un texto por cada original actual de los jurados. Si el admin ya lo había revisado (el original coincide con uno
// que vio), se conserva SU versión, incluso si la vació. Si es nuevo o el jurado lo cambió, aparece tal cual lo escribió
// el jurado y queda marcado para que el admin lo revise. Solo se marca cuando ya había una revisión previa.
export function armarTextos(actuales: string[], vistos: string[], guardados: string[], hayRevision: boolean) {
  const items = actuales.map((original) => {
    const i = vistos.indexOf(original);
    return i >= 0 && guardados[i] !== undefined
      ? { original, texto: guardados[i], nuevo: false }
      : { original, texto: original, nuevo: hayRevision };
  });
  // Textos que el admin había revisado y que el jurado cambió o quitó: se muestran como referencia, no se reaplican.
  const reemplazados = vistos.flatMap((v, i) => (!actuales.includes(v) && (guardados[i] ?? "").trim() ? [guardados[i]] : []));
  return { items, reemplazados };
}

export async function cargarEvento(supabase: Cliente, eventoId: string) {
  const [evento, publicacion, salones, criterios, evaluaciones, devoluciones, ausencias, vistos] = await Promise.all([
    supabase.from("eventos").select("id, nombre, inicio").eq("id", eventoId).maybeSingle(),
    supabase.from("jurado_publicaciones").select("publicada_at, personas(nombre)").eq("evento_id", eventoId).maybeSingle(),
    supabase
      .from("jurado_salones")
      .select("id, nombre, jurado_salon_proyectos(proyecto_id, proyectos(nombre)), jurado_salon_jurados(jurado_id, personas(nombre))")
      .eq("evento_id", eventoId)
      .order("orden"),
    criteriosDelEvento(supabase, eventoId),
    supabase
      .from("jurado_evaluaciones")
      .select("id, proyecto_id, jurado_id, propuesta_valor, comentarios, jurado_puntajes(criterio_id, puntaje)")
      .eq("evento_id", eventoId),
    supabase.from("jurado_devoluciones").select("*").eq("evento_id", eventoId),
    supabase.from("jurado_ausencias").select("proyecto_id").eq("evento_id", eventoId),
    supabase.from("jurado_devoluciones_vistos").select("proyecto_id, comentarios, propuestas").eq("evento_id", eventoId),
  ]);
  if (evento.error?.code === "22P02") return null;
  for (const r of [evento, publicacion, salones, evaluaciones, devoluciones, ausencias, vistos]) if (r.error) throw r.error;
  if (!evento.data) return null;

  // Una evaluación está completa cuando tiene nota en todos los criterios de este evento.
  const delEvento = new Set(criterios.map((c) => c.id));
  const totalCriterios = delEvento.size;
  const ausentes = new Set(ausencias.data!.map((a) => a.proyecto_id));
  const equipos = salones.data!.flatMap((s) => s.jurado_salon_proyectos.map((sp) => ({
    id: sp.proyecto_id,
    nombre: sp.proyectos.nombre,
    salon: { id: s.id, nombre: s.nombre },
    jurados: s.jurado_salon_jurados.map((j) => ({ id: j.jurado_id, nombre: j.personas.nombre })),
  })));

  // La "foto" actual de las evaluaciones de cada equipo, calculada por la base igual que al revisar.
  const huellas = await Promise.all(equipos.map(async (q) => {
    const { data, error } = await supabase.rpc("jurado_huella", { p_evento: eventoId, p_proyecto: q.id });
    if (error) throw error;
    return [q.id, data] as const;
  }));
  const huellaActual = new Map(huellas);
  const bloqueos = await evaluacionesBloqueadas(supabase, eventoId);

  const resumen = equipos.map((q) => {
    const evs = evaluaciones.data!.filter((e) => e.proyecto_id === q.id);
    const completas = evs.filter((e) => totalCriterios > 0 && e.jurado_puntajes.filter((p) => delEvento.has(p.criterio_id)).length >= totalCriterios);
    const devolucion = devoluciones.data!.find((d) => d.proyecto_id === q.id) ?? null;
    const estado: Estado = ausentes.has(q.id)
      ? "ausente"
      : completas.length === 0
        ? "sin_evaluaciones"
        : !devolucion
          ? "sin_revisar"
          : devolucion.huella !== huellaActual.get(q.id)
            ? "desactualizada"
            : "lista";
    const puntajes = evs.flatMap((e) => e.jurado_puntajes);
    return {
      ...q,
      estado,
      devolucion,
      // Los textos originales que el admin vio al revisar (tabla solo para admin).
      vistos: vistos.data!.find((v) => v.proyecto_id === q.id) ?? null,
      evaluaciones: evs,
      // Pendientes: jurados habilitados sin evaluación completa. Los no habilitados (ya lo evaluaron en otro evento) van aparte.
      faltan: q.jurados.filter((j) => !bloqueos.has(`${q.id}:${j.id}`) && !completas.some((e) => e.jurado_id === j.id)),
      noHabilitados: q.jurados
        .filter((j) => bloqueos.has(`${q.id}:${j.id}`))
        .map((j) => ({ ...j, motivo: motivoBloqueo(bloqueos.get(`${q.id}:${j.id}`) ?? null, false) })),
      // Vista previa de las notas: la base las vuelve a calcular igual al guardar la devolución.
      general: promedio(puntajes.map((p) => p.puntaje)),
      porCriterio: criterios.map((c) => ({
        criterio: c.nombre,
        promedio: promedio(puntajes.filter((p) => p.criterio_id === c.id).map((p) => p.puntaje)),
      })),
      comentariosOriginales: textosSinNombre(evs.map((e) => e.comentarios)),
      propuestasOriginales: textosSinNombre(evs.map((e) => e.propuesta_valor)),
    };
  });

  return { evento: evento.data, publicacion: publicacion.data, salones: salones.data!, equipos: resumen };
}

export type Equipo = NonNullable<Awaited<ReturnType<typeof cargarEvento>>>["equipos"][number];
