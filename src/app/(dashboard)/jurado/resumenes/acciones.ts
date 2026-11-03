"use server";
// GRUPO JURADO — acciones del resumen del pitch. Todas son solo para el admin.
// Los archivos van directo del navegador a Supabase con una URL firmada (así no pasan por el servidor de Next, que
// limita el tamaño); después se registran acá.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BUCKET, contarPalabras, MAX_BYTES, tipos, type Tipo } from "../_resumenes";
import { generarResumen } from "./agente";

const extension = (nombre: string) => nombre.split(".").pop()?.toLowerCase() ?? "";
// Las claves de Storage no aceptan cualquier carácter: el nombre original queda en la tabla.
const nombreSeguro = (nombre: string) =>
  nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-80);
const esTipo = (tipo: string): tipo is Tipo => tipo in tipos;

export async function prepararSubida(eventoId: string, proyectoId: string, tipo: string, nombre: string, bytes: number) {
  await requireRol();
  if (!esTipo(tipo)) return { ok: false as const, mensaje: "Tipo de archivo desconocido." };
  const mime = tipos[tipo].extensiones[extension(nombre)];
  if (!mime) return { ok: false as const, mensaje: `Para la ${tipos[tipo].titulo.toLowerCase()} se acepta: ${Object.keys(tipos[tipo].extensiones).join(", ")}.` };
  if (bytes <= 0 || bytes > MAX_BYTES) return { ok: false as const, mensaje: "El archivo tiene que pesar menos de 10 MB." };

  const supabase = await createClient();
  const ruta = `${eventoId}/${proyectoId}/${crypto.randomUUID()}-${nombreSeguro(nombre)}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(ruta);
  if (error) return { ok: false as const, mensaje: "No se pudo preparar la subida. Probá de nuevo." };
  return { ok: true as const, url: data.signedUrl, ruta, mime };
}

// Registra el archivo subido. Si ya había uno de ese tipo, lo reemplaza (y borra el anterior del bucket).
export async function registrarArchivo(eventoId: string, proyectoId: string, tipo: string, ruta: string, nombre: string, bytes: number) {
  const persona = await requireRol();
  const mime = esTipo(tipo) ? tipos[tipo].extensiones[extension(nombre)] : undefined;
  if (!esTipo(tipo) || !mime || !ruta.startsWith(`${eventoId}/${proyectoId}/`)) return { ok: false, mensaje: "Ese archivo no corresponde al equipo." };

  const supabase = await createClient();
  const carpeta = `${eventoId}/${proyectoId}`;
  const archivo = ruta.slice(carpeta.length + 1);
  const { data: subidos } = await supabase.storage.from(BUCKET).list(carpeta, { search: archivo });
  if (!subidos?.some((s) => s.name === archivo)) return { ok: false, mensaje: "El archivo no llegó a subirse. Probá de nuevo." };

  const { data: anterior } = await supabase
    .from("jurado_resumen_archivos")
    .select("ruta")
    .eq("evento_id", eventoId).eq("proyecto_id", proyectoId).eq("tipo", tipo)
    .maybeSingle();
  // Id nuevo aunque reemplace: así el panel sabe que el resumen se generó con el archivo viejo.
  const { error } = await supabase.from("jurado_resumen_archivos").upsert(
    { id: crypto.randomUUID(), evento_id: eventoId, proyecto_id: proyectoId, tipo, nombre: nombre.trim(), ruta, mime, bytes, subido_por: persona.id, created_at: new Date().toISOString() },
    { onConflict: "evento_id,proyecto_id,tipo" },
  );
  if (error) {
    await supabase.storage.from(BUCKET).remove([ruta]);
    return { ok: false, mensaje: "No se pudo registrar el archivo." };
  }
  if (anterior) await supabase.storage.from(BUCKET).remove([anterior.ruta]);
  revalidatePath("/jurado/resumenes", "layout");
  return { ok: true, mensaje: `"${nombre}" subido${anterior ? " (reemplazó al anterior)" : ""}.` };
}

// `volver` es la pantalla desde donde se mandó el formulario (el panel o la revisión de un equipo).
function volver(formData: FormData, tipo: "ok" | "error", mensaje: string): never {
  revalidatePath("/jurado/resumenes", "layout");
  const pedido = String(formData.get("volver") ?? "");
  const destino = pedido.startsWith("/jurado/resumenes") ? pedido : "/jurado/resumenes";
  const separador = destino.includes("?") ? "&" : "?";
  redirect(`${destino}${separador}${tipo}=${encodeURIComponent(mensaje)}`);
}

export async function borrarArchivo(formData: FormData) {
  await requireRol();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jurado_resumen_archivos")
    .delete()
    .eq("id", String(formData.get("archivo_id")))
    .select("nombre, ruta")
    .maybeSingle();
  if (error) throw error;
  if (data) await supabase.storage.from(BUCKET).remove([data.ruta]);
  volver(formData, "ok", data ? `"${data.nombre}" borrado.` : "El archivo ya no estaba.");
}

export async function generar(formData: FormData) {
  const persona = await requireRol();
  const supabase = await createClient();
  const resultado = await generarResumen(supabase, String(formData.get("evento_id")), String(formData.get("proyecto_id")), persona.id);
  volver(formData, resultado.ok ? "ok" : "error", resultado.mensaje);
}

// Guarda lo que editó el admin. Con `aprobar`, además lo publica para los jurados del salón del equipo.
export async function guardar(formData: FormData) {
  const persona = await requireRol();
  const supabase = await createClient();
  const aprobar = formData.get("accion") === "aprobar";
  const texto = String(formData.get("texto") ?? "").trim() || null;
  if (aprobar && !texto) volver(formData, "error", "Para aprobar, el resumen no puede estar vacío.");
  const ahora = new Date().toISOString();
  const { error } = await supabase
    .from("jurado_resumenes")
    .update({
      texto,
      palabras: contarPalabras(texto),
      updated_at: ahora,
      ...(aprobar && { estado: "aprobado", aviso: null, aprobado_por: persona.id, aprobado_at: ahora }),
    })
    .eq("evento_id", String(formData.get("evento_id")))
    .eq("proyecto_id", String(formData.get("proyecto_id")));
  if (error) throw error;
  volver(formData, "ok", aprobar ? "Resumen aprobado: ya lo ven los jurados de su salón." : "Cambios guardados.");
}

export async function despublicar(formData: FormData) {
  await requireRol();
  const supabase = await createClient();
  const { error } = await supabase
    .from("jurado_resumenes")
    .update({ estado: "borrador", aprobado_por: null, aprobado_at: null, updated_at: new Date().toISOString() })
    .eq("evento_id", String(formData.get("evento_id")))
    .eq("proyecto_id", String(formData.get("proyecto_id")));
  if (error) throw error;
  volver(formData, "ok", "El resumen volvió a revisión: los jurados ya no lo ven.");
}
