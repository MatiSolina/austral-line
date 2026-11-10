"use server";

// GRUPO ALUMNOS — acciones de los profesores sobre el armado de grupos. Corren con sus permisos de admin:
// aprobar una propuesta crea el proyecto y sus integrantes (lo hace la función de la base, todo junto).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const volver = (aviso: { error?: string; ok?: string }) => {
  revalidatePath("/alumnos", "layout");
  redirect(`/alumnos/aprobaciones?${aviso.error ? `error=${encodeURIComponent(aviso.error)}` : `ok=${encodeURIComponent(aviso.ok ?? "")}`}`);
};

export async function guardarCierre(formData: FormData) {
  await requireRol(); // sin roles = solo admin (profesores)
  const valor = String(formData.get("cierre") ?? "");
  // El input datetime-local viene sin zona: se interpreta en hora de Argentina (-03:00).
  const cierre = valor ? new Date(`${valor}:00-03:00`).toISOString() : null;
  const supabase = await createClient();
  const { error } = await supabase.from("alumnos_armado_config").update({ cierre, updated_at: new Date().toISOString() }).eq("id", 1);
  volver(error ? { error: `No se pudo guardar: ${error.message}` } : { ok: cierre ? "Fecha de cierre guardada." : "Se quitó la fecha de cierre." });
}

export async function aprobarPropuesta(formData: FormData) {
  await requireRol();
  const supabase = await createClient();
  const { error } = await supabase.rpc("alumnos_aprobar_propuesta", { p_propuesta: String(formData.get("propuesta_id")) });
  volver(error ? { error: error.message } : { ok: "Grupo aprobado: ya figura en Proyectos." });
}

export async function devolverPropuesta(formData: FormData) {
  await requireRol();
  const supabase = await createClient();
  const { error } = await supabase.rpc("alumnos_devolver_propuesta", {
    p_propuesta: String(formData.get("propuesta_id")),
    p_comentario: String(formData.get("comentario") ?? ""),
  });
  volver(error ? { error: error.message } : { ok: "Propuesta devuelta al grupo con tu comentario." });
}

export async function resolverSolicitud(formData: FormData) {
  await requireRol();
  const aprobar = formData.get("decision") === "aprobar";
  const supabase = await createClient();
  const { error } = await supabase.rpc("alumnos_resolver_solicitud", {
    p_solicitud: String(formData.get("solicitud_id")),
    p_aprobar: aprobar,
    p_respuesta: String(formData.get("respuesta") ?? ""),
  });
  volver(error ? { error: error.message } : { ok: aprobar ? "Solicitud aprobada: ya se movió al alumno." : "Solicitud rechazada." });
}
