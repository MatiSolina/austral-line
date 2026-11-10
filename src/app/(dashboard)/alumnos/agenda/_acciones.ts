"use server";

// GRUPO ALUMNOS — el alumno guarda su disponibilidad semanal (reemplaza la anterior).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function guardarDisponibilidad(formData: FormData) {
  const persona = await requireRol("alumno");
  const proyecto = String(formData.get("proyecto_id") ?? "");
  const volver = (aviso: string, error = false) => {
    revalidatePath("/alumnos/agenda");
    redirect(`/alumnos/agenda?${proyecto ? `proyecto=${proyecto}&` : ""}${error ? "error" : "ok"}=${encodeURIComponent(aviso)}`);
  };
  // Cada casilla marcada llega como "dia-franja" (por ejemplo "1-2" = lunes de 12 a 16).
  const franjas = formData
    .getAll("franja")
    .map(String)
    .map((v) => v.split("-").map(Number))
    .filter(([d, f]) => d >= 1 && d <= 6 && f >= 1 && f <= 4)
    .map(([dia, franja]) => ({ persona_id: persona.id, dia, franja }));
  const supabase = await createClient();
  const { error: errorBorrar } = await supabase.from("alumnos_disponibilidad").delete().eq("persona_id", persona.id);
  if (errorBorrar) volver(`No se pudo guardar: ${errorBorrar.message}`, true);
  if (franjas.length) {
    const { error } = await supabase.from("alumnos_disponibilidad").insert(franjas);
    if (error) volver(`No se pudo guardar: ${error.message}`, true);
  }
  volver("Disponibilidad guardada.");
}
