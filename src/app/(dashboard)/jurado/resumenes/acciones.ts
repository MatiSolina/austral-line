"use server";
// GRUPO JURADO — acciones del resumen del pitch. Todas son solo para el admin.
// Los archivos van directo del navegador a Supabase con una URL firmada (así no pasan por el servidor de Next, que
// limita el tamaño); después se registran acá.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cancelarCorreo, modoPrueba, type Correo } from "../_resend";
import { BUCKET, contarPalabras, limiteEntrega, MAX_BYTES, tipos, yaPaso, type Tipo } from "../_resumenes";
import { urlBase } from "../comunicaciones/datos";
import { fechaHora } from "../comunicaciones/plantillas";
import { generarResumen } from "./agente";
import { estadosActivos, juradosPorSalon, mandarYRegistrar } from "./envios";
import { mailEntrega } from "./plantillas";

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

const LIMITE_RESEND = 30 * 24 * 60 * 60 * 1000; // Resend programa hasta 30 días antes
const simulado = (mensaje: string) => (modoPrueba() ? `Simulado (falta la clave de Resend, no salió ningún mail): ${mensaje}` : mensaje);

// Programa el mail a cada jurado de cada salón para el día anterior al evento a las 18:00 (si ya pasó, sale ahora).
// No se repite: si un jurado ya lo tiene programado o enviado, se saltea (sirve para sumar jurados nuevos).
export async function programarEntrega(formData: FormData) {
  await requireRol();
  const supabase = await createClient();
  const eventoId = String(formData.get("evento_id"));
  const { data: evento, error } = await supabase.from("eventos").select("id, nombre, inicio").eq("id", eventoId).maybeSingle();
  if (error) throw error;
  if (!evento) volver(formData, "error", "No encontramos el evento.");
  if (yaPaso(evento.inicio)) volver(formData, "error", "El evento ya empezó: la entrega de resúmenes ya no tiene sentido.");

  const limite = new Date(limiteEntrega(evento.inicio)).getTime();
  const ahora = Date.now();
  if (limite - ahora > LIMITE_RESEND) {
    volver(formData, "error", `Resend permite programar mails hasta 30 días antes. Vas a poder programar la entrega desde el ${fechaHora(new Date(limite - LIMITE_RESEND).toISOString())}.`);
  }
  const programadoPara = limite > ahora + 60_000 ? new Date(limite).toISOString() : null;

  const [salones, { data: previos, error: errorPrevios }] = await Promise.all([
    juradosPorSalon(supabase, eventoId),
    supabase.from("jurado_resumen_envios").select("persona_id").eq("evento_id", eventoId).eq("tipo", "entrega").in("estado", estadosActivos()),
  ]);
  if (errorPrevios) throw errorPrevios;
  const tienen = new Set(previos.map((p) => p.persona_id));
  const url = await urlBase();
  const correos: Correo[] = [];
  const filas: Parameters<typeof mandarYRegistrar>[2] = [];
  for (const s of salones) {
    for (const j of s.jurados.filter((j) => !tienen.has(j.id))) {
      const { asunto, html } = mailEntrega({ jurado: j.nombre, evento, salon: s.nombre, equipos: s.equipos, url });
      correos.push({ para: j.email, asunto, html, programadoPara: programadoPara ?? undefined });
      filas.push({ evento_id: eventoId, tipo: "entrega", persona_id: j.id, email: j.email, asunto, programado_para: programadoPara, estado: "programado" });
    }
  }
  if (salones.every((s) => s.jurados.length === 0)) volver(formData, "error", "Este evento no tiene jurados en salones. Se asignan desde Salones.");
  if (correos.length === 0) volver(formData, "error", "Todos los jurados ya tienen la entrega. Si cambió el horario del evento, cancelala y volvé a programarla.");

  const fallo = await mandarYRegistrar(supabase, correos, filas);
  if (fallo) volver(formData, "error", fallo);
  const a = `${correos.length} ${correos.length === 1 ? "jurado" : "jurados"}`;
  volver(formData, "ok", simulado(programadoPara ? `Entrega programada para el ${fechaHora(programadoPara)} a ${a}.` : `Ya pasaron las 18:00 del día anterior: la entrega salió ahora a ${a}.`));
}

// Si cambia el horario del evento: cancela las entregas que todavía no salieron, para volver a programarlas.
export async function cancelarEntrega(formData: FormData) {
  await requireRol();
  const supabase = await createClient();
  const eventoId = String(formData.get("evento_id"));
  const { data: pendientes, error } = await supabase
    .from("jurado_resumen_envios").select("id, resend_id")
    .eq("evento_id", eventoId).eq("tipo", "entrega").in("estado", ["programado", "simulado"])
    .gt("programado_para", new Date().toISOString());
  if (error) throw error;
  if (pendientes.length === 0) volver(formData, "error", "No hay entregas pendientes para cancelar.");

  const cancelados: string[] = [];
  let fallo: string | null = null;
  for (const envio of pendientes) {
    const problema = envio.resend_id && !modoPrueba() ? await cancelarCorreo(envio.resend_id) : null;
    if (problema) fallo = problema;
    else cancelados.push(envio.id);
  }
  if (cancelados.length) {
    const { error: errorUpdate } = await supabase.from("jurado_resumen_envios").update({ estado: "cancelado" }).in("id", cancelados);
    if (errorUpdate) throw errorUpdate;
  }
  if (fallo) volver(formData, "error", `Se cancelaron ${cancelados.length} de ${pendientes.length}. ${fallo}`);
  volver(formData, "ok", `Se cancelaron ${cancelados.length} entregas pendientes.`);
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
