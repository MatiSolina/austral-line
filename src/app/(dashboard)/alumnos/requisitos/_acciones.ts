"use server";

// GRUPO ALUMNOS — acciones de "Requisitos": el alumno pregunta (y la IA responde o la pasa a los profesores);
// los profesores cargan el reglamento y contestan las preguntas derivadas.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hayIA, responder } from "./_agente";

const volver = (aviso?: { error?: string; ok?: string }) => {
  revalidatePath("/alumnos/requisitos");
  const q = aviso?.error ? `?error=${encodeURIComponent(aviso.error)}` : aviso?.ok ? `?ok=${encodeURIComponent(aviso.ok)}` : "";
  redirect(`/alumnos/requisitos${q}`);
};

export async function preguntar(formData: FormData) {
  await requireRol("alumno");
  const pregunta = String(formData.get("pregunta") ?? "").trim();
  if (pregunta.length < 5) volver({ error: "Escribí tu pregunta (al menos 5 caracteres)." });
  const supabase = await createClient();

  const { data: id, error: errorReserva } = await supabase.rpc("alumnos_reservar_pregunta", { p_pregunta: pregunta.slice(0, 1000) });
  if (errorReserva || !id) volver({ error: errorReserva?.message ?? "No se pudo enviar la pregunta." });

  const { data: reglamento } = await supabase.from("alumnos_reglamento").select("texto").eq("id", 1).maybeSingle();
  const texto = reglamento?.texto?.trim() ?? "";

  // Sin reglamento cargado o sin IA, la pregunta va directo a los profesores.
  let completar: { p_estado: string; p_respuesta?: string; p_cita?: string } = { p_estado: "derivada" };
  if (texto && hayIA()) {
    try {
      const r = await responder(texto, pregunta);
      if (r.estado === "respondida") completar = { p_estado: "respondida", p_respuesta: r.respuesta, p_cita: r.cita };
    } catch (e) {
      console.error("[alumnos/requisitos] la IA falló", e);
      completar = { p_estado: "error" };
    }
  }
  const { error } = await supabase.rpc("alumnos_completar_pregunta", { p_pregunta: id!, ...completar });
  if (error) console.error("[alumnos/requisitos] no se pudo guardar la respuesta", error);
  volver(
    completar.p_estado === "respondida"
      ? { ok: "Listo: la respuesta está abajo." }
      : { ok: "No encontramos la respuesta en el reglamento: se la pasamos a los profesores, que te van a contestar acá." },
  );
}

export async function derivar(formData: FormData) {
  await requireRol("alumno");
  const supabase = await createClient();
  const { error } = await supabase.rpc("alumnos_derivar_pregunta", { p_pregunta: String(formData.get("pregunta_id")) });
  volver(error ? { error: error.message } : { ok: "Se la pasamos a los profesores." });
}

export async function guardarReglamento(formData: FormData) {
  const persona = await requireRol();
  const texto = String(formData.get("texto") ?? "").slice(0, 60000);
  const supabase = await createClient();
  const { error } = await supabase
    .from("alumnos_reglamento")
    .update({ texto, updated_at: new Date().toISOString(), updated_by: persona.id })
    .eq("id", 1);
  volver(error ? { error: `No se pudo guardar: ${error.message}` } : { ok: "Reglamento guardado." });
}

export async function contestar(formData: FormData) {
  const persona = await requireRol();
  const respuesta = String(formData.get("respuesta") ?? "").trim();
  if (respuesta.length < 2) volver({ error: "Escribí la respuesta." });
  const supabase = await createClient();
  const { error } = await supabase
    .from("alumnos_preguntas")
    .update({ estado: "contestada", respuesta_profesores: respuesta.slice(0, 3000), respondida_por: persona.id, respondida_at: new Date().toISOString() })
    .eq("id", String(formData.get("pregunta_id")));
  volver(error ? { error: `No se pudo guardar: ${error.message}` } : { ok: "Respuesta enviada." });
}
