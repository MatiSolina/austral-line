"use server";
// GRUPO MENTORES — acciones de Reuniones. Las reuniones las cargan los mentores (las suyas) y el coordinador (todas).
// Después de cada cambio corre el agente de resumen pre-reunión, que es el único que escribe resúmenes.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ponerAlDia, prepararResumen, rehacerSiguientes, urlBase, type Resultado } from "./agente";
import { desdeInput } from "./fechas";

const texto = (formData: FormData, campo: string) => String(formData.get(campo) ?? "").trim() || null;

function volver(ruta: string, { ok, mensaje }: Resultado): never {
  revalidatePath("/mentores/reuniones", "layout");
  redirect(`${ruta}?${ok ? "ok" : "error"}=${encodeURIComponent(mensaje)}`);
}

export async function crearReunion(formData: FormData) {
  const persona = await requireRol("mentor");
  // El mentor carga reuniones suyas; el coordinador elige el mentor.
  const mentorId = persona.rol === "admin" ? texto(formData, "mentor_id") : persona.id;
  const proyectoId = texto(formData, "proyecto_id");
  const inicio = desdeInput(String(formData.get("inicio") ?? ""));
  if (!proyectoId || !mentorId || !inicio) {
    volver("/mentores/reuniones", { ok: false, mensaje: "Completá el proyecto, el mentor y la fecha y hora." });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mentores_reuniones")
    .insert({ proyecto_id: proyectoId, mentor_id: mentorId, inicio, lugar: texto(formData, "lugar"), cargada_por: persona.id })
    .select("id")
    .single();
  if (error) throw error;

  const url = await urlBase();
  const resultado = await prepararResumen(supabase, data.id, url);
  await ponerAlDia(supabase, url, [data.id]);
  volver(`/mentores/reuniones/${data.id}`, { ok: resultado.ok, mensaje: `Reunión guardada. ${resultado.mensaje}` });
}

export async function editarReunion(formData: FormData) {
  await requireRol("mentor");
  const id = String(formData.get("id"));
  const inicio = desdeInput(String(formData.get("inicio") ?? ""));
  if (!inicio) volver(`/mentores/reuniones/${id}`, { ok: false, mensaje: "La fecha y hora no es válida." });

  const supabase = await createClient();
  const { data: antes, error: errorAntes } = await supabase.from("mentores_reuniones").select("inicio").eq("id", id).single();
  if (errorAntes) throw errorAntes;
  const { error } = await supabase
    .from("mentores_reuniones")
    .update({ inicio, lugar: texto(formData, "lugar"), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;

  const nuevaFecha = new Date(antes.inicio).getTime() !== new Date(inicio).getTime();
  const resultado = await prepararResumen(supabase, id, await urlBase(), { nuevaFecha });
  volver(`/mentores/reuniones/${id}`, { ok: resultado.ok, mensaje: `Cambios guardados. ${resultado.mensaje}` });
}

export async function guardarNotas(formData: FormData) {
  await requireRol("mentor");
  const id = String(formData.get("id"));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mentores_reuniones")
    .update({ notas: texto(formData, "notas"), proximos_pasos: texto(formData, "proximos_pasos"), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("proyecto_id, mentor_id")
    .single();
  if (error) throw error;

  // Las notas nuevas cambian lo que tiene que decir el resumen de la próxima reunión con este equipo.
  const url = await urlBase();
  await rehacerSiguientes(supabase, data.proyecto_id, data.mentor_id, url);
  await ponerAlDia(supabase, url);
  volver(`/mentores/reuniones/${id}`, {
    ok: true,
    mensaje: "Notas guardadas. El asistente las va a usar en el resumen de la próxima reunión con este equipo.",
  });
}

export async function cancelarReunion(formData: FormData) {
  await requireRol("mentor");
  const id = String(formData.get("id"));
  const supabase = await createClient();
  const { error } = await supabase
    .from("mentores_reuniones")
    .update({ cancelada: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;

  const resultado = await prepararResumen(supabase, id, await urlBase());
  volver(`/mentores/reuniones/${id}`, { ok: resultado.ok, mensaje: `Reunión cancelada. ${resultado.mensaje}` });
}

export async function reactivarReunion(formData: FormData) {
  await requireRol("mentor");
  const id = String(formData.get("id"));
  const supabase = await createClient();
  const { error } = await supabase
    .from("mentores_reuniones")
    .update({ cancelada: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;

  const resultado = await prepararResumen(supabase, id, await urlBase());
  volver(`/mentores/reuniones/${id}`, { ok: resultado.ok, mensaje: `Reunión activa de nuevo. ${resultado.mensaje}` });
}

// Para cuando cambió algo que el asistente no ve solo (por ejemplo, la descripción del proyecto) o falló un envío.
export async function rehacerResumen(formData: FormData) {
  await requireRol("mentor");
  const id = String(formData.get("id"));
  const resultado = await prepararResumen(await createClient(), id, await urlBase());
  volver(`/mentores/reuniones/${id}`, resultado);
}

// El coordinador marca si el aviso del asistente le sirvió: es la métrica de "escaló bien los problemas".
export async function marcarAviso(formData: FormData) {
  await requireRol(); // solo admin
  const supabase = await createClient();
  const { error } = await supabase
    .from("mentores_resumenes")
    .update({ aviso_util: formData.get("util") === "si" })
    .eq("id", String(formData.get("resumen_id")));
  if (error) throw error;
  volver("/mentores/reuniones", { ok: true, mensaje: "Listo, quedó registrado." });
}
