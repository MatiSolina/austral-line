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
