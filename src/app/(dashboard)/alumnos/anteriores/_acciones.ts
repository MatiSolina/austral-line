"use server";

// GRUPO ALUMNOS — los profesores cargan y quitan proyectos de años anteriores.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const volver = (aviso: { error?: string; ok?: string }) => {
  revalidatePath("/alumnos", "layout");
  redirect(`/alumnos/anteriores?${aviso.error ? `error=${encodeURIComponent(aviso.error)}` : `ok=${encodeURIComponent(aviso.ok ?? "")}`}`);
};

export async function agregarAnterior(formData: FormData) {
  const persona = await requireRol(); // solo profesores (admin)
  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const anio = Number(formData.get("anio"));
  const resultado = String(formData.get("resultado") ?? "").trim();
  if (nombre.length < 2 || descripcion.length < 10) volver({ error: "Completá el nombre y una descripción (al menos 10 caracteres)." });
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) volver({ error: "El año no es válido." });
  const supabase = await createClient();
  const { error } = await supabase.from("alumnos_proyectos_anteriores").insert({
    nombre: nombre.slice(0, 120),
    anio,
    descripcion: descripcion.slice(0, 3000),
    resultado: resultado.slice(0, 500) || null,
    cargado_por: persona.id,
  });
  volver(error ? { error: `No se pudo guardar: ${error.message}` } : { ok: "Proyecto agregado." });
}

export async function quitarAnterior(formData: FormData) {
  await requireRol();
  const supabase = await createClient();
  const { error } = await supabase.from("alumnos_proyectos_anteriores").delete().eq("id", String(formData.get("id")));
  volver(error ? { error: `No se pudo quitar: ${error.message}` } : { ok: "Proyecto quitado." });
}
