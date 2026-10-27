"use server";
// GRUPO MENTORES — acciones del feedback post reunión. Cada uno contesta solo su encuesta (lo asegura la base);
// el coordinador marca si cada resumen le sirvió y puede pedir que se vuelva a armar.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { urlBase } from "../reuniones/agente";
import { armarResumen, revisarRespuesta } from "./agente";

const texto = (formData: FormData, campo: string) => String(formData.get(campo) ?? "").trim().slice(0, 2000) || null;

function volver(ruta: string, ok: boolean, mensaje: string): never {
  revalidatePath("/mentores", "layout");
  redirect(`${ruta}?${ok ? "ok" : "error"}=${encodeURIComponent(mensaje)}`);
}

export async function responderEncuesta(formData: FormData) {
  await requireRol("mentor", "alumno");
  const id = String(formData.get("id"));
  const ruta = `/mentores/mi-feedback/${id}`;
  const puntaje = Number(formData.get("puntaje"));
  if (!Number.isInteger(puntaje) || puntaje < 1 || puntaje > 5) volver(ruta, false, "Elegí qué tan útil fue la reunión, del 1 al 5.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mentores_encuestas")
    .update({
      puntaje,
      sirvio: texto(formData, "sirvio"),
      mejorar: texto(formData, "mejorar"),
      urgente: texto(formData, "urgente"),
      estado: "respondida",
      respondida_at: new Date().toISOString(),
    })
    .eq("id", id)
    .neq("estado", "respondida") // una vez contestada no se cambia: el resumen ya pudo usarla
    .select("id");
  if (error) throw error;
  if (!data.length) volver(ruta, false, "Esta encuesta ya estaba contestada.");

  const escalada = await revisarRespuesta(supabase, id, await urlBase());
  volver(ruta, true, escalada
    ? "¡Gracias! Le avisamos al coordinador para que se ocupe de lo que contaste."
    : "¡Gracias! Tu respuesta llegó al coordinador.");
}

// Calidad del resumen final: el coordinador marca si le sirvió.
export async function marcarResumen(formData: FormData) {
  await requireRol(); // solo admin
  const supabase = await createClient();
  const { error } = await supabase
    .from("mentores_feedback_resumenes")
    .update({ util: formData.get("util") === "si" })
    .eq("id", String(formData.get("resumen_id")));
  if (error) throw error;
  volver("/mentores/feedback", true, "Listo, quedó registrado.");
}

// Por ejemplo, si alguien contestó tarde después de que se armó el resumen.
export async function rehacerResumen(formData: FormData) {
  await requireRol(); // solo admin
  await armarResumen(await createClient(), String(formData.get("reunion_id")), { rehacer: true });
  volver("/mentores/feedback", true, "Resumen armado de nuevo con las respuestas que hay.");
}
