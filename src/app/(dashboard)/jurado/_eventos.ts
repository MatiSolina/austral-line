// GRUPO JURADO — qué evento se muestra y en qué salón está cada jurado. Lo usan la planilla, la evaluación y la deliberación.
import type { createClient } from "@/lib/supabase/server";

type Cliente = Awaited<ReturnType<typeof createClient>>;
export type Evento = { id: string; nombre: string; inicio: string };

// Sin elección explícita: el evento de hoy o el próximo; si ya pasaron todos, el último.
export function elegirEvento<T extends Evento>(eventos: T[], elegido: unknown): T | undefined {
  const desde = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  return eventos.find((e) => e.id === elegido) ?? eventos.find((e) => e.inicio >= desde) ?? eventos.at(-1);
}

// Eventos que puede ver cada uno: el admin, todos; el jurado, solo aquellos en los que tiene salón.
export async function eventosVisibles(supabase: Cliente, persona: { id: string; rol: string }) {
  if (persona.rol === "admin") {
    const { data, error } = await supabase.from("eventos").select("id, nombre, inicio").order("inicio");
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase
    .from("jurado_salon_jurados")
    .select("jurado_salones(eventos(id, nombre, inicio))")
    .eq("jurado_id", persona.id);
  if (error) throw error;
  return data.map((a) => a.jurado_salones.eventos).sort((a, b) => a.inicio.localeCompare(b.inicio));
}

// Salón del jurado en un evento, con sus equipos. null si no está asignado.
export async function salonDelJurado(supabase: Cliente, eventoId: string, juradoId: string) {
  const { data, error } = await supabase
    .from("jurado_salon_jurados")
    .select("jurado_salones(id, nombre, jurado_salon_proyectos(proyecto_id))")
    .eq("evento_id", eventoId)
    .eq("jurado_id", juradoId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const salon = data.jurado_salones;
  return { id: salon.id, nombre: salon.nombre, proyectos: salon.jurado_salon_proyectos.map((p) => p.proyecto_id) };
}

export const conEvento = (ruta: string, eventoId: string | undefined) => (eventoId ? `${ruta}?evento=${eventoId}` : ruta);

// Hasta que se habilite evaluar a un mismo equipo en más de un evento, cada jurado tiene una sola evaluación por equipo.
// Si ya la cargó en otro evento (o antes de separar las notas por evento), en este evento ese equipo queda bloqueado
// para él: no es una evaluación pendiente. Devuelve "proyecto:jurado" → nombre del evento, o null si la nota no tiene evento.
export async function evaluacionesBloqueadas(supabase: Cliente, eventoId: string, juradoId?: string) {
  let consulta = supabase
    .from("jurado_evaluaciones")
    .select("proyecto_id, jurado_id, eventos(nombre)")
    .or(`evento_id.is.null,evento_id.neq.${eventoId}`);
  if (juradoId) consulta = consulta.eq("jurado_id", juradoId);
  const { data, error } = await consulta;
  if (error) throw error;
  return new Map(data.map((e) => [`${e.proyecto_id}:${e.jurado_id}`, e.eventos?.nombre ?? null]));
}

// Por qué un equipo bloqueado no se puede evaluar, contado al jurado o al organizador.
export const motivoBloqueo = (evento: string | null, paraElJurado: boolean) =>
  evento
    ? `${paraElJurado ? "Ya lo evaluaste" : "Ya lo evaluó"} en ${evento}`
    : `${paraElJurado ? "Tenés" : "Tiene"} una nota anterior a la separación por evento`;
