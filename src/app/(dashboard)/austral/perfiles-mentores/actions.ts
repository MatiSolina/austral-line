"use server";

import { revalidatePath } from "next/cache";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validarCabeceraAudio } from "./_audio";

export type Resultado = { ok: boolean; mensaje: string };
const RUTA = "/austral/perfiles-mentores";
const BUCKET = "austral-audios-mentores";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIPOS: Record<string, string> = {
  mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", webm: "audio/webm",
};
const validarUrl = (valor: string) => {
  if (!valor) return true;
  try { return new URL(valor).protocol === "https:"; } catch { return false; }
};
const validarLinkedIn = (valor: string) => {
  if (!valor) return true;
  try {
    const url = new URL(valor);
    return url.protocol === "https:" && (url.hostname === "linkedin.com" || url.hostname.endsWith(".linkedin.com"));
  } catch { return false; }
};

export async function guardarPresentacion(_previo: Resultado, datos: FormData): Promise<Resultado> {
  const mentor = await requireRol("mentor");
  if (mentor.rol !== "mentor") return { ok: false, mensaje: "Solo el mentor puede editar su presentación." };
  const trayectoria = String(datos.get("trayectoria") ?? "").trim();
  const intereses = String(datos.get("intereses") ?? "").trim();
  const cv_url = String(datos.get("cv_url") ?? "").trim();
  const linkedin_url = String(datos.get("linkedin_url") ?? "").trim();
  const autoriza_audio = datos.get("autoriza_audio") === "on";
  if (trayectoria.length > 3000 || intereses.length > 1500 || cv_url.length > 500 ||
      linkedin_url.length > 500 || !validarUrl(cv_url) || !validarLinkedIn(linkedin_url)) {
    return { ok: false, mensaje: "Revisá los textos y usá enlaces HTTPS válidos para el CV y LinkedIn." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("austral_perfiles_mentores").upsert({
    mentor_id: mentor.id, trayectoria, intereses, cv_url, linkedin_url, autoriza_audio,
    actualizado_at: new Date().toISOString(),
  }, { onConflict: "mentor_id" });
  if (error) return { ok: false, mensaje: "No se pudo guardar la presentación." };
  revalidatePath(RUTA);
  return { ok: true, mensaje: "Presentación guardada. Austral la revisará antes de publicarla." };
}

export async function prepararAudio(nombre: string, bytes: number) {
  const mentor = await requireRol("mentor");
  if (mentor.rol !== "mentor") return { ok: false as const, mensaje: "Solo el mentor puede subir su audio." };
  const extension = nombre.split(".").pop()?.toLowerCase() ?? "";
  const mime = TIPOS[extension];
  if (!mime) return { ok: false as const, mensaje: "Formato incompatible. Usá MP3, M4A, WAV o WebM." };
  if (bytes <= 0 || bytes > 10 * 1024 * 1024) return { ok: false as const, mensaje: "El audio debe pesar hasta 10 MB." };
  const ruta = `${mentor.id}/${crypto.randomUUID()}.${extension}`;
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(ruta);
  if (error || !data) return { ok: false as const, mensaje: "No se pudo preparar la subida del audio." };
  return { ok: true as const, url: data.signedUrl, ruta, mime };
}

export async function registrarAudio(ruta: string, mime: string): Promise<Resultado> {
  const mentor = await requireRol("mentor");
  if (mentor.rol !== "mentor") return { ok: false, mensaje: "Solo el mentor puede registrar su audio." };
  const extension = ruta.split(".").pop()?.toLowerCase() ?? "";
  if (!ruta.startsWith(`${mentor.id}/`) || ruta.split("/").length !== 2 || !TIPOS[extension] || TIPOS[extension] !== mime) {
    return { ok: false, mensaje: "Archivo inválido." };
  }
  const supabase = await createClient();
  const archivo = ruta.slice(mentor.id.length + 1);
  const { data: archivos } = await supabase.storage.from(BUCKET).list(mentor.id, { search: archivo });
  const subido = archivos?.find((item) => item.name === archivo);
  if (!subido || !subido.metadata?.size || subido.metadata.size > 10 * 1024 * 1024) return { ok: false, mensaje: "El audio no llegó a subirse o supera los 10 MB." };
  const { data: audio, error: errorAudio } = await supabase.storage.from(BUCKET).download(ruta);
  if (errorAudio || !audio) return { ok: false, mensaje: "No se pudo verificar el audio. Probá nuevamente." };
  if (!validarCabeceraAudio(extension, new Uint8Array(await audio.slice(0, 16).arrayBuffer()))) {
    return { ok: false, mensaje: "El contenido no corresponde al formato de audio indicado. Exportalo nuevamente como MP3, M4A, WAV o WebM." };
  }
  const { data: anterior } = await supabase.from("austral_perfiles_mentores")
    .select("audio_path").eq("mentor_id", mentor.id).maybeSingle();
  const { error } = await supabase.from("austral_perfiles_mentores").upsert({
    mentor_id: mentor.id, audio_path: ruta, audio_mime: mime, autoriza_audio: false,
    actualizado_at: new Date().toISOString(),
  }, { onConflict: "mentor_id" });
  if (error) return { ok: false, mensaje: "No se pudo registrar el audio." };
  if (anterior?.audio_path && anterior.audio_path !== ruta) {
    await supabase.storage.from(BUCKET).remove([anterior.audio_path]);
  }
  revalidatePath(RUTA);
  return { ok: true, mensaje: "Audio subido. Marcá la autorización y guardá para enviarlo a revisión." };
}

export async function guardarResumen(datos: FormData) {
  await requireRol();
  const mentorId = String(datos.get("mentor_id") ?? "");
  const resumen = String(datos.get("resumen") ?? "").trim();
  if (!UUID.test(mentorId) || resumen.length > 800) return;
  const supabase = await createClient();
  const { error } = await supabase.from("austral_perfiles_mentores")
    .update({ resumen, estado: "revision", actualizado_at: new Date().toISOString() })
    .eq("mentor_id", mentorId);
  if (error) throw error;
  revalidatePath(RUTA);
}

export async function publicarPerfil(datos: FormData) {
  await requireRol();
  const mentorId = String(datos.get("mentor_id") ?? "");
  if (!UUID.test(mentorId)) return;
  const supabase = await createClient();
  const [{ data: perfil }, { data: contacto }] = await Promise.all([
    supabase.from("austral_perfiles_mentores").select("resumen, audio_path, autoriza_audio")
      .eq("mentor_id", mentorId).maybeSingle(),
    supabase.from("austral_contactos_mentores").select("industria, especialidades, publicado")
      .eq("mentor_id", mentorId).maybeSingle(),
  ]);
  if (!perfil?.resumen.trim() || !contacto?.publicado || !contacto.industria.trim() ||
      !contacto.especialidades.length) return;
  const { error } = await supabase.from("austral_perfiles_mentores")
    .update({ estado: "publicado", publicado_at: new Date().toISOString() })
    .eq("mentor_id", mentorId);
  if (error) throw error;
  revalidatePath(RUTA);
}

export async function retirarPerfil(datos: FormData) {
  await requireRol();
  const mentorId = String(datos.get("mentor_id") ?? "");
  if (!UUID.test(mentorId)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("austral_perfiles_mentores")
    .update({ estado: "revision", publicado_at: null }).eq("mentor_id", mentorId);
  if (error) throw error;
  revalidatePath(RUTA);
}

export async function registrarEscucha(mentorId: string) {
  const alumno = await requireRol("alumno");
  if (alumno.rol !== "alumno" || !UUID.test(mentorId)) return;
  const supabase = await createClient();
  await supabase.from("austral_perfiles_escuchas").insert({ mentor_id: mentorId, alumno_id: alumno.id });
}

export async function valorarPerfil(datos: FormData) {
  const alumno = await requireRol("alumno");
  const mentorId = String(datos.get("mentor_id") ?? "");
  const puntaje = Number(datos.get("puntaje"));
  if (alumno.rol !== "alumno" || !UUID.test(mentorId) || !Number.isInteger(puntaje) || puntaje < 1 || puntaje > 5) return;
  const supabase = await createClient();
  const { error } = await supabase.from("austral_perfiles_valoraciones").upsert({
    mentor_id: mentorId, alumno_id: alumno.id, puntaje, actualizado_at: new Date().toISOString(),
  }, { onConflict: "mentor_id,alumno_id" });
  if (error) throw error;
  revalidatePath(RUTA);
}
