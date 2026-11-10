"use server";

// GRUPO ALUMNOS — acciones de los profesores para el puntaje: mínimo, puntos por hito y notas.
// Solo admin (requireRol() sin roles); la base también lo exige (RLS).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { numero } from "../_lib/puntaje";

const volver = (formData: FormData, aviso?: { error?: string; ok?: string }) => {
  revalidatePath("/alumnos/puntaje");
  const proyecto = String(formData.get("proyecto_id") ?? "");
  const q = new URLSearchParams();
  if (proyecto) q.set("proyecto", proyecto);
  if (aviso?.error) q.set("error", aviso.error);
  if (aviso?.ok) q.set("ok", aviso.ok);
  redirect(`/alumnos/puntaje?${q.toString()}`);
};

// "7,5" o "7.5" → 7.5; vacío → null; cualquier otra cosa → NaN.
const leerNumero = (valor: FormDataEntryValue | null) => {
  const t = String(valor ?? "").trim().replace(",", ".");
  return t === "" ? null : Number(t);
};

export async function guardarMinimo(formData: FormData) {
  await requireRol();
  const minimo = leerNumero(formData.get("minimo"));
  if (minimo !== null && (Number.isNaN(minimo) || minimo < 0)) volver(formData, { error: "El mínimo tiene que ser un número positivo." });
  const supabase = await createClient();
  const { error } = await supabase.from("alumnos_puntaje_config").update({ minimo, updated_at: new Date().toISOString() }).eq("id", 1);
  volver(formData, error ? { error: `No se pudo guardar: ${error.message}` } : { ok: "Mínimo guardado." });
}

export async function guardarMaximo(formData: FormData) {
  await requireRol();
  const eventoId = String(formData.get("evento_id"));
  const maximo = leerNumero(formData.get("maximo"));
  const supabase = await createClient();
  if (maximo === null) {
    const { error } = await supabase.from("alumnos_puntaje_hitos").delete().eq("evento_id", eventoId);
    volver(formData, error ? { error: `No se pudo guardar: ${error.message}` } : { ok: "El hito ya no suma puntos." });
  }
  if (Number.isNaN(maximo) || maximo! <= 0) volver(formData, { error: "Los puntos del hito tienen que ser un número mayor a 0." });
  const { error } = await supabase
    .from("alumnos_puntaje_hitos")
    .upsert({ evento_id: eventoId, maximo: maximo!, updated_at: new Date().toISOString() });
  volver(formData, error ? { error: `No se pudo guardar: ${error.message}` } : { ok: "Puntos del hito guardados." });
}

// Guarda las notas de un hito para un grupo: la del grupo y las de cada integrante. Campo vacío = sin nota.
export async function guardarNotas(formData: FormData) {
  const persona = await requireRol();
  const eventoId = String(formData.get("evento_id"));
  const proyectoId = String(formData.get("proyecto_id"));
  const supabase = await createClient();

  const cargas: { proyecto_id: string | null; persona_id: string | null; campo: string }[] = [];
  if (formData.has("grupo")) cargas.push({ proyecto_id: proyectoId, persona_id: null, campo: "grupo" });
  for (const id of formData.getAll("integrante").map(String)) cargas.push({ proyecto_id: null, persona_id: id, campo: `alumno_${id}` });

  // Se valida todo antes de tocar nada: si un valor está mal, no se borra ninguna nota ya cargada.
  const { data: hito, error: errorHito } = await supabase.from("alumnos_puntaje_hitos").select("maximo").eq("evento_id", eventoId).maybeSingle();
  if (errorHito) volver(formData, { error: `No se pudo guardar: ${errorHito.message}` });
  if (!hito) volver(formData, { error: "Primero fijá cuántos puntos vale este hito." });
  const maximo = Number(hito!.maximo);
  const filas = cargas.map((c) => ({ ...c, puntos: leerNumero(formData.get(c.campo)) }));
  if (filas.some((f) => f.puntos !== null && (Number.isNaN(f.puntos) || f.puntos < 0 || f.puntos > maximo)))
    volver(formData, { error: `Los puntos tienen que ser números entre 0 y ${numero(maximo)}.` });

  for (const { puntos, ...c } of filas) {
    // Se reemplaza la nota anterior (si había) por la nueva; campo vacío = queda sin nota.
    const anterior = supabase.from("alumnos_notas").delete().eq("evento_id", eventoId);
    const { error: errorBorrar } = await (c.proyecto_id ? anterior.eq("proyecto_id", c.proyecto_id) : anterior.eq("persona_id", c.persona_id!));
    if (errorBorrar) volver(formData, { error: `No se pudo guardar: ${errorBorrar.message}` });
    if (puntos === null) continue;
    const { error } = await supabase.from("alumnos_notas").insert({
      evento_id: eventoId,
      proyecto_id: c.proyecto_id,
      persona_id: c.persona_id,
      puntos,
      comentario: String(formData.get(`comentario_${c.campo}`) ?? "").trim().slice(0, 500) || null,
      cargada_por: persona.id,
    });
    if (error) volver(formData, { error: error.message.startsWith("El hito") || error.message.startsWith("Primero") ? error.message : `No se pudo guardar: ${error.message}` });
  }
  volver(formData, { ok: "Notas guardadas." });
}
