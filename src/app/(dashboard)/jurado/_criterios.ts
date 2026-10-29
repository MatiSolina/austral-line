// GRUPO JURADO — los criterios se definen por evento: cada evento puntúa los suyos, en su orden.
import type { createClient } from "@/lib/supabase/server";

type Cliente = Awaited<ReturnType<typeof createClient>>;

export async function criteriosDelEvento(supabase: Cliente, eventoId: string | undefined) {
  if (!eventoId) return [];
  const { data, error } = await supabase
    .from("jurado_evento_criterios")
    .select("orden, jurado_criterios(id, nombre, descripcion)")
    .eq("evento_id", eventoId)
    .order("orden");
  if (error) throw error;
  return data.map((r) => r.jurado_criterios);
}
