"use server";

import { revalidatePath } from "next/cache";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { avisarAlMentor, avisarALosEquipos, type Estado } from "./_avisos";

export type Resultado = { ok: boolean; mensaje: string };
const RUTA = "/austral/compatibilidad";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ETAPAS = ["idea", "prototipo", "validacion", "crecimiento"];

export async function registrarNecesidades(_previo: Resultado, datos: FormData): Promise<Resultado> {
  const admin = await requireRol("admin");
  const proyectoId = String(datos.get("proyecto_id") ?? "");
  const etapa = String(datos.get("etapa") ?? "");
  const sector = String(datos.get("sector") ?? "").trim();
  const contexto = String(datos.get("contexto") ?? "").trim();
  const necesidades = [...new Map(String(datos.get("necesidades") ?? "")
    .split(/[,\n]+/).map((tag) => tag.trim()).filter(Boolean)
    .map((tag) => [tag.toLocaleLowerCase("es"), tag])).values()];
  if (!UUID.test(proyectoId) || !ETAPAS.includes(etapa) || sector.length > 100 ||
      contexto.length > 1200 || necesidades.length < 1 || necesidades.length > 10 ||
      necesidades.some((tag) => tag.length > 50)) {
    return { ok: false, mensaje: "Revisá la etapa, el sector y entre 1 y 10 necesidades de hasta 50 caracteres." };
  }
  const supabase = await createClient();
  const { data: proyecto } = await supabase.from("proyectos").select("id").eq("id", proyectoId).maybeSingle();
  if (!proyecto) return { ok: false, mensaje: "Proyecto inválido." };
  const { error } = await supabase.from("austral_necesidades_revision").insert({
    proyecto_id: proyectoId, etapa, sector, necesidades, contexto, registrado_por: admin.id,
  });
  if (error) return { ok: false, mensaje: "No se pudo guardar la revisión. Probá de nuevo." };
  revalidatePath(RUTA);
  return { ok: true, mensaje: "Necesidades guardadas y coincidencias actualizadas." };
}

export async function designarTitular(_previo: Resultado, datos: FormData): Promise<Resultado> {
  const admin = await requireRol("admin");
  const proyectoId = String(datos.get("proyecto_id") ?? "");
  const mentorId = String(datos.get("mentor_id") ?? "");
  if (!UUID.test(proyectoId) || !UUID.test(mentorId) || datos.get("confirmado") !== "on") {
    return { ok: false, mensaje: "Elegí un mentor vinculado y confirmá la designación formal." };
  }
  const supabase = await createClient();
  const { data: vinculo } = await supabase.from("austral_vinculos_mentor_proyecto")
    .select("mentor_id").eq("proyecto_id", proyectoId).eq("mentor_id", mentorId).maybeSingle();
  if (!vinculo) return { ok: false, mensaje: "Ese mentor todavía no tiene un vínculo formal con el proyecto." };
  const { data: previo } = await supabase.from("austral_titulares_proyecto").select("mentor_id").eq("proyecto_id", proyectoId).maybeSingle();
  const { error } = await supabase.from("austral_titulares_proyecto")
    .upsert({ proyecto_id: proyectoId, mentor_id: mentorId, designado_por: admin.id, designado_at: new Date().toISOString() },
      { onConflict: "proyecto_id" });
  if (error) return { ok: false, mensaje: "No se pudo designar al titular." };
  // Solo se le avisa cuando es un titular nuevo para el proyecto (volver a guardar el mismo no repite el mail).
  const aviso = previo?.mentor_id === mentorId ? null : await avisarAlMentor(supabase, proyectoId, mentorId, admin.id);
  revalidatePath(RUTA);
  revalidatePath("/austral/contacto-mentores");
  return { ok: aviso?.estado !== "error", mensaje: `Mentor titular registrado. ${aviso ? textoAviso(aviso) : "Ya era el titular: no se repitió el aviso."}` };
}

const textoAviso = ({ estado, detalle }: { estado: Estado; detalle: string | null }) => ({
  enviado: `Le mandamos un mail a ${detalle} avisándole.`,
  simulado: `Aviso por mail simulado a ${detalle} (falta configurar Resend para que salga de verdad).`,
  error: `No se pudo mandar el mail: ${detalle}`,
  sin_email: "El mentor no tiene mail cargado: avisale por WhatsApp o cargá su mail en Contactos de mentores.",
})[estado];

export async function reenviarAvisoMentor(_previo: Resultado, datos: FormData): Promise<Resultado> {
  const admin = await requireRol("admin");
  const proyectoId = String(datos.get("proyecto_id") ?? "");
  if (!UUID.test(proyectoId)) return { ok: false, mensaje: "Proyecto inválido." };
  const supabase = await createClient();
  const { data: titular } = await supabase.from("austral_titulares_proyecto").select("mentor_id").eq("proyecto_id", proyectoId).maybeSingle();
  if (!titular) return { ok: false, mensaje: "El proyecto ya no tiene mentor titular." };
  const aviso = await avisarAlMentor(supabase, proyectoId, titular.mentor_id, admin.id);
  revalidatePath(RUTA);
  return { ok: aviso.estado !== "error", mensaje: textoAviso(aviso) };
}

// Solo cuando todos los proyectos con integrantes tienen mentor titular: mail a cada integrante con su mentor.
export async function avisarEquipos(_previo: Resultado, datos: FormData): Promise<Resultado> {
  const admin = await requireRol("admin");
  if (datos.get("confirmado") !== "on") return { ok: false, mensaje: "Confirmá que querés mandar los mails a los equipos." };
  const supabase = await createClient();
  const [{ data: integrantes, error: e1 }, { data: titulares, error: e2 }] = await Promise.all([
    supabase.from("proyecto_integrantes").select("proyecto_id"),
    supabase.from("austral_titulares_proyecto").select("proyecto_id"),
  ]);
  if (e1 || e2) return { ok: false, mensaje: "No se pudieron leer los proyectos. Probá de nuevo." };
  const conTitular = new Set(titulares.map((t) => t.proyecto_id));
  const faltan = new Set(integrantes.map((i) => i.proyecto_id).filter((id) => !conTitular.has(id)));
  if (faltan.size) return { ok: false, mensaje: `Todavía hay ${faltan.size} proyecto(s) con integrantes y sin mentor titular.` };

  const { cuenta, errores } = await avisarALosEquipos(supabase, admin.id);
  revalidatePath(RUTA);
  const partes = [
    cuenta.enviado && `${cuenta.enviado} mail(s) enviados`,
    cuenta.simulado && `${cuenta.simulado} mail(s) simulados (falta configurar Resend)`,
    cuenta.sin_email && `${cuenta.sin_email} integrante(s) sin mail cargado`,
    cuenta.repetidos && `${cuenta.repetidos} ya habían sido avisados`,
    cuenta.error && `${cuenta.error} con error: ${errores.join(" ")}`,
  ].filter(Boolean);
  return { ok: !cuenta.error, mensaje: partes.length ? `${partes.join(" · ")}.` : "No hay integrantes para avisar." };
}

export async function quitarTitular(_previo: Resultado, datos: FormData): Promise<Resultado> {
  await requireRol("admin");
  const proyectoId = String(datos.get("proyecto_id") ?? "");
  if (!UUID.test(proyectoId) || datos.get("confirmado") !== "on") {
    return { ok: false, mensaje: "Confirmá que querés quitar el mentor titular." };
  }
  const supabase = await createClient();
  const { error, count } = await supabase.from("austral_titulares_proyecto")
    .delete({ count: "exact" }).eq("proyecto_id", proyectoId);
  if (error) return { ok: false, mensaje: "No se pudo quitar al mentor titular." };
  if (!count) return { ok: false, mensaje: "El proyecto ya no tiene un mentor titular registrado." };
  revalidatePath(RUTA);
  revalidatePath("/austral/contacto-mentores");
  return { ok: true, mensaje: "Mentor titular quitado. El vínculo formal se conserva." };
}

export async function decidirSugerencia(_previo: Resultado, datos: FormData): Promise<Resultado> {
  const admin = await requireRol("admin");
  const proyectoId = String(datos.get("proyecto_id") ?? "");
  const revisionId = String(datos.get("revision_id") ?? "");
  const mentorId = String(datos.get("mentor_id") ?? "");
  const estado = String(datos.get("estado") ?? "");
  if (![proyectoId, revisionId, mentorId].every((id) => UUID.test(id)) ||
      !["considerada", "descartada"].includes(estado)) {
    return { ok: false, mensaje: "Datos de la sugerencia inválidos. Actualizá la página y probá de nuevo." };
  }
  const supabase = await createClient();
  const [{ data: ultima }, { data: puntuacion }, { data: contacto }, { data: titular }, { data: vinculo }] = await Promise.all([
    supabase.from("austral_necesidades_revision").select("id").eq("proyecto_id", proyectoId)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("austral_compatibilidades").select("porcentaje").eq("revision_id", revisionId)
      .eq("mentor_id", mentorId).eq("proyecto_id", proyectoId).maybeSingle(),
    supabase.from("austral_contactos_mentores").select("modalidad, publicado, acepta_consultas_otros")
      .eq("mentor_id", mentorId).maybeSingle(),
    supabase.from("austral_titulares_proyecto").select("mentor_id").eq("proyecto_id", proyectoId).maybeSingle(),
    supabase.from("austral_vinculos_mentor_proyecto").select("mentor_id").eq("proyecto_id", proyectoId)
      .eq("mentor_id", mentorId).maybeSingle(),
  ]);
  if (ultima?.id !== revisionId || !puntuacion || puntuacion.porcentaje < 60 ||
      !contacto?.publicado || !["consulta", "ambas"].includes(contacto.modalidad) ||
      (!contacto.acepta_consultas_otros && !vinculo) || titular?.mentor_id === mentorId) {
    return { ok: false, mensaje: "La sugerencia ya no está disponible. Actualizá la página." };
  }
  const { error } = await supabase.from("austral_recomendaciones_sesion").upsert({
    revision_id: revisionId, proyecto_id: proyectoId, mentor_id: mentorId,
    estado, decidido_por: admin.id, decidido_at: new Date().toISOString(),
  }, { onConflict: "revision_id,mentor_id" });
  if (error) return { ok: false, mensaje: "No se pudo guardar la decisión. Probá de nuevo." };
  revalidatePath(RUTA);
  return { ok: true, mensaje: estado === "considerada" ? "Consulta marcada para considerar." : "Sugerencia descartada." };
}
