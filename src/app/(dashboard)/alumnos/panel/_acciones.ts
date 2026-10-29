"use server";

// GRUPO ALUMNOS — moderación de reportes del banco de ideas (solo profesores / rol admin).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const volverCon = (error: string) => redirect(`/alumnos/panel?error=${encodeURIComponent(error)}#reportes`);

const listo = () => {
  revalidatePath("/alumnos", "layout");
  redirect("/alumnos/panel#reportes");
};

// "Dejar visible": el contenido queda y sus reportes pendientes se marcan como revisados.
export async function dejarVisible(formData: FormData) {
  await requireRol(); // sin roles = solo admin (profesores)
  const ideaId = String(formData.get("idea_id"));
  const mensajeId = String(formData.get("mensaje_id") ?? "") || null;
  const supabase = await createClient();
  let consulta = supabase.from("alumnos_ideas_reportes").update({ resuelto: true }).eq("idea_id", ideaId).eq("resuelto", false);
  consulta = mensajeId ? consulta.eq("mensaje_id", mensajeId) : consulta.is("mensaje_id", null);
  const { error } = await consulta;
  if (error) volverCon(`No se pudo marcar como revisado: ${error.message}`);
  listo();
}

// "Borrar": se borra la idea (con sus interesados, mensajes y reportes) o solo el mensaje (con sus respuestas).
export async function borrarReportado(formData: FormData) {
  await requireRol();
  const ideaId = String(formData.get("idea_id"));
  const mensajeId = String(formData.get("mensaje_id") ?? "") || null;
  const supabase = await createClient();
  const { error } = mensajeId
    ? await supabase.from("alumnos_ideas_mensajes").delete().eq("id", mensajeId)
    : await supabase.from("alumnos_ideas").delete().eq("id", ideaId);
  if (error) volverCon(`No se pudo borrar: ${error.message}`);
  listo();
}
