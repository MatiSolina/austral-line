"use server";
// GRUPO AUSTRAL — subida de documentos del proyecto (alumnos). El archivo va directo del navegador a Supabase con una
// URL firmada (así no pasa por el servidor de Next, que limita el tamaño); después se registra acá.
import { revalidatePath } from "next/cache";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BUCKET, MAX_BYTES, tiposPorExtension } from "../_preparacion";

type Resultado = { ok: true; mensaje: string } | { ok: false; mensaje: string };

const extension = (nombre: string) => nombre.split(".").pop()?.toLowerCase() ?? "";
// Las claves de Storage no aceptan cualquier carácter: el nombre original queda en la tabla.
const nombreSeguro = (nombre: string) =>
  nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-80);

export async function prepararSubida(proyectoId: string, nombre: string, bytes: number) {
  await requireRol("alumno");
  if (!tiposPorExtension[extension(nombre)]) return { ok: false as const, mensaje: "Solo se pueden subir PDF, .txt o .md." };
  if (bytes <= 0 || bytes > MAX_BYTES) return { ok: false as const, mensaje: "El archivo tiene que pesar menos de 10 MB." };

  const supabase = await createClient();
  const ruta = `${proyectoId}/${crypto.randomUUID()}-${nombreSeguro(nombre)}`;
  // La policy del bucket solo deja firmar en la carpeta de un proyecto propio.
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(ruta);
  if (error) return { ok: false as const, mensaje: "No tenés permiso para subir documentos a ese proyecto." };
  return { ok: true as const, url: data.signedUrl, ruta, tipo: tiposPorExtension[extension(nombre)] };
}

export async function registrarDocumento(proyectoId: string, ruta: string, nombre: string, bytes: number): Promise<Resultado> {
  const persona = await requireRol("alumno");
  const tipo = tiposPorExtension[extension(nombre)];
  if (!tipo || !ruta.startsWith(`${proyectoId}/`)) return { ok: false, mensaje: "Ese archivo no corresponde al proyecto." };

  const supabase = await createClient();
  const archivo = ruta.slice(proyectoId.length + 1);
  const { data: subidos } = await supabase.storage.from(BUCKET).list(proyectoId, { search: archivo });
  if (!subidos?.some((s) => s.name === archivo)) return { ok: false, mensaje: "El archivo no llegó a subirse. Probá de nuevo." };

  const { error } = await supabase
    .from("austral_documentos")
    .insert({ proyecto_id: proyectoId, ruta, nombre: nombre.trim(), tipo, bytes, subido_por: persona.id });
  if (error) {
    await supabase.storage.from(BUCKET).remove([ruta]);
    return { ok: false, mensaje: "No se pudo registrar el documento." };
  }
  revalidatePath("/austral", "layout");
  return { ok: true, mensaje: `"${nombre}" subido.` };
}

export async function borrarDocumento(formData: FormData) {
  await requireRol("alumno");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("austral_documentos")
    .delete()
    .eq("id", String(formData.get("documento_id")))
    .select("ruta")
    .maybeSingle();
  if (error) throw error;
  if (data) await supabase.storage.from(BUCKET).remove([data.ruta]);
  revalidatePath("/austral", "layout");
}
