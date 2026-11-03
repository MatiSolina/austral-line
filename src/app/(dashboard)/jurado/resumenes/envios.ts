// GRUPO JURADO — mails del resumen del pitch: entrega a los jurados y alerta a los admins. Todo queda registrado en
// jurado_resumen_envios. Sin RESEND_API_KEY no sale nada: quedan como "simulado" (igual que en "Mails a jurados").
import type { Database } from "@/lib/database.types";
import { conMail } from "@/lib/supabase/tipos";
import { enviarCorreos, modoPrueba, type Correo } from "../_resend";
import { urlBase } from "../comunicaciones/datos";
import type { Supabase } from "../_resumenes";
import { mailAlerta } from "./plantillas";

type Envio = Database["public"]["Tables"]["jurado_resumen_envios"]["Insert"];

// Envíos que cuentan como "ya mandado o por salir". Con la clave de Resend cargada, lo simulado en modo prueba no cuenta.
export const estadosActivos = () => (modoPrueba() ? ["programado", "simulado", "enviado"] : ["programado", "enviado"]);

// Manda y deja registro de cada mail. Devuelve el error de Resend, si hubo.
export async function mandarYRegistrar(supabase: Supabase, correos: Correo[], filas: Envio[]) {
  const resultado = await enviarCorreos(correos);
  const { error } = await supabase.from("jurado_resumen_envios").insert(filas.map((fila, i) => ({
    ...fila,
    estado: !resultado.ok ? "error" : modoPrueba() ? "simulado" : fila.programado_para ? "programado" : "enviado",
    resend_id: resultado.ok ? resultado.ids[i] : null,
    error: resultado.ok ? null : resultado.error,
  })));
  if (error) throw error;
  return resultado.ok ? null : resultado.error;
}

// Jurados de cada salón del evento, con su mail. Los que no tienen mail visible no pueden recibir la entrega.
export async function juradosPorSalon(supabase: Supabase, eventoId: string) {
  const { data, error } = await supabase
    .from("jurado_salones")
    .select("id, nombre, jurado_salon_proyectos(proyectos(nombre)), jurado_salon_jurados(personas:personas_contacto(id, nombre, email))")
    .eq("evento_id", eventoId)
    .order("orden");
  if (error) throw error;
  return data.map((s) => ({
    nombre: s.nombre,
    equipos: s.jurado_salon_proyectos.map((sp) => sp.proyectos.nombre).sort((a, b) => a.localeCompare(b, "es")),
    jurados: s.jurado_salon_jurados.map((j) => j.personas).filter((p): p is { id: string; nombre: string; email: string } => !!p?.id && conMail(p)),
  }));
}

// Escalamiento del documento de IA Lab: cuando el agente frena, el reporte les llega en el momento a todos los admins.
// Si el mail falla no corta la generación: el reporte igual queda en el panel.
export async function alertarAdmins(supabase: Supabase, evento: { id: string; nombre: string; inicio: string }, equipo: { id: string; nombre: string }, reporte: string) {
  try {
    const { data: admins, error } = await supabase.from("personas_contacto").select("id, nombre, email").eq("rol", "admin");
    if (error) throw error;
    const destinatarios = admins.filter(conMail);
    if (destinatarios.length === 0) return;
    const { asunto, html } = mailAlerta({
      evento,
      equipo: equipo.nombre,
      reporte,
      link: `${await urlBase()}/jurado/resumenes/${equipo.id}?evento=${evento.id}`,
    });
    await mandarYRegistrar(
      supabase,
      destinatarios.map((a) => ({ para: a.email, asunto, html })),
      destinatarios.map((a) => ({ evento_id: evento.id, tipo: "alerta", proyecto_id: equipo.id, persona_id: a.id, email: a.email, asunto, estado: "enviado" })),
    );
  } catch (e) {
    console.error("No se pudo mandar la alerta del resumen del pitch", e);
  }
}
