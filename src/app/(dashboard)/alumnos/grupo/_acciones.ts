"use server";

// GRUPO ALUMNOS — acciones del armado de grupos de los alumnos. Las reglas las valida la base
// (funciones alumnos_*): acá solo se llaman y se muestra el error en lenguaje claro.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const volver = (aviso: { error?: string; ok?: string }) => {
  revalidatePath("/alumnos", "layout");
  const q = aviso.error ? `error=${encodeURIComponent(aviso.error)}` : `ok=${encodeURIComponent(aviso.ok ?? "")}`;
  redirect(`/alumnos/grupo?${q}`);
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Llama a una función de la base con los permisos del alumno y vuelve con el resultado.
const llamar = async (accion: (s: Supabase) => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
  await requireRol("alumno");
  const { error } = await accion(await createClient());
  volver(error ? { error: error.message } : { ok });
};

export async function crearPropuesta(formData: FormData) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const idea = String(formData.get("idea_id") ?? "") || null;
  if (nombre.length < 2) volver({ error: "Poné un nombre tentativo para el grupo." });
  await llamar(
    (s) => s.rpc("alumnos_crear_propuesta", { p_nombre: nombre, p_idea: idea ?? undefined }),
    "Propuesta creada. Ahora invitá a tus compañeros.",
  );
}

export async function invitar(formData: FormData) {
  await llamar(
    (s) => s.rpc("alumnos_invitar", { p_propuesta: String(formData.get("propuesta_id")), p_persona: String(formData.get("persona_id")) }),
    "Invitación enviada.",
  );
}

export async function responderInvitacion(formData: FormData) {
  const acepta = formData.get("respuesta") === "aceptar";
  await llamar(
    (s) => s.rpc("alumnos_responder_invitacion", { p_propuesta: String(formData.get("propuesta_id")), p_acepta: acepta }),
    acepta ? "¡Te sumaste al grupo!" : "Rechazaste la invitación.",
  );
}

export async function salirPropuesta(formData: FormData) {
  await llamar((s) => s.rpc("alumnos_salir_propuesta", { p_propuesta: String(formData.get("propuesta_id")) }), "Saliste de la propuesta.");
}

export async function enviarPropuesta(formData: FormData) {
  await llamar(
    (s) => s.rpc("alumnos_enviar_propuesta", { p_propuesta: String(formData.get("propuesta_id")) }),
    "Enviado a los profesores. Te avisamos acá cuando lo aprueben.",
  );
}

export async function pedirCambio(formData: FormData) {
  const persona = await requireRol("alumno");
  const motivo = String(formData.get("motivo") ?? "").trim();
  const destino = String(formData.get("destino") ?? "");
  if (motivo.length < 5) volver({ error: "Contá brevemente el motivo (al menos 5 caracteres)." });
  const supabase = await createClient();
  const { error } = await supabase.from("alumnos_solicitudes_cambio").insert({
    persona_id: persona.id,
    proyecto_origen: String(formData.get("origen")),
    proyecto_destino: destino === "salir" ? null : destino,
    motivo,
  });
  if (error?.code === "23505") volver({ error: "Ya tenés una solicitud pendiente." });
  volver(error ? { error: `No se pudo enviar la solicitud: ${error.message}` } : { ok: "Solicitud enviada a los profesores." });
}

export async function cancelarSolicitud(formData: FormData) {
  await llamar((s) => s.rpc("alumnos_cancelar_solicitud", { p_solicitud: String(formData.get("solicitud_id")) }), "Cancelaste la solicitud.");
}
