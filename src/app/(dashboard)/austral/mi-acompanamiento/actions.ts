"use server";

import { revalidatePath } from "next/cache";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type Resultado = { ok: boolean; mensaje: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function guardarExperiencia(_previo: Resultado, datos: FormData): Promise<Resultado> {
  const alumno = await requireRol("alumno");
  if (alumno.rol !== "alumno") return { ok: false, mensaje: "Solo un alumno puede enviar su experiencia." };
  const proyectoId = String(datos.get("proyecto_id") ?? "");
  const puntaje = Number(datos.get("puntaje"));
  const comentario = String(datos.get("comentario") ?? "").trim();
  if (!UUID.test(proyectoId) || !Number.isInteger(puntaje) || puntaje < 1 || puntaje > 5 || comentario.length > 500) {
    return { ok: false, mensaje: "Revisá el puntaje y el comentario." };
  }
  const supabase = await createClient();
  const { data: integrante } = await supabase.from("proyecto_integrantes").select("proyecto_id")
    .eq("proyecto_id", proyectoId).eq("persona_id", alumno.id).maybeSingle();
  if (!integrante) return { ok: false, mensaje: "Ese proyecto no pertenece a tu equipo." };
  const { error } = await supabase.from("austral_satisfaccion_mentoria").upsert({
    proyecto_id: proyectoId, alumno_id: alumno.id, puntaje, comentario,
    actualizado_at: new Date().toISOString(),
  }, { onConflict: "proyecto_id,alumno_id" });
  if (error) return { ok: false, mensaje: "No se pudo guardar tu opinión." };
  revalidatePath("/austral/mi-acompanamiento");
  return { ok: true, mensaje: "Gracias. Austral tendrá en cuenta tu opinión sobre el acompañamiento." };
}
