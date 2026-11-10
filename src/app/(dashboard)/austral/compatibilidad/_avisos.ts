// GRUPO AUSTRAL — avisos de la mentoría titular: mail al mentor cuando se lo designa, link de WhatsApp listo para mandar
// y mail a los integrantes de cada equipo con el mentor que les tocó. Todo queda registrado en austral_avisos_mentoria.
import type { createClient } from "@/lib/supabase/server";
import { enviarCorreo, escapar, modoPrueba, pausa } from "../_resend";

type Supabase = Awaited<ReturnType<typeof createClient>>;
export type Estado = "enviado" | "simulado" | "error" | "sin_email";

// Teléfono → número para wa.me (solo dígitos, con código de país). Pensado para números argentinos: sin código de país
// se antepone 54 9; con 54 pero sin el 9 de celulares, se agrega. Devuelve null si no parece un teléfono.
export function numeroWhatsApp(telefono: string | null | undefined) {
  let n = (telefono ?? "").replace(/\D/g, "").replace(/^00/, "");
  if (!n) return null;
  if (n.startsWith("0")) n = n.slice(1);
  if (n.length === 10) n = `549${n}`;
  else if (n.startsWith("54") && !n.startsWith("549") && n.length === 12) n = `549${n.slice(2)}`;
  return n.length >= 11 && n.length <= 15 ? n : null;
}

export function linkWhatsApp(telefono: string | null | undefined, mentor: string, proyecto: string, integrantes: string[]) {
  const numero = numeroWhatsApp(telefono);
  if (!numero) return null;
  const texto = `Hola ${mentor}! Te escribimos de Emprendimientos Austral: te asignamos como mentor titular del proyecto "${proyecto}"${
    integrantes.length ? `, integrado por ${integrantes.length === 1 ? integrantes[0] : `${integrantes.slice(0, -1).join(", ")} y ${integrantes.at(-1)}`}` : ""}. Te mandamos también los datos por mail. ¡Gracias por acompañarlos!`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

const plantilla = (titulo: string, parrafos: string[]) => `
<div style="font-family:Arial,sans-serif;max-width:560px;color:#111">
  <h2 style="font-weight:normal">${escapar(titulo)}</h2>
  ${parrafos.map((p) => `<p style="line-height:1.5">${p}</p>`).join("\n  ")}
  <p style="color:#666;font-size:12px">Emprendimientos — Universidad Austral</p>
</div>`;

async function datosDelEquipo(supabase: Supabase, proyectoId: string) {
  const { data: filas, error } = await supabase.from("proyecto_integrantes").select("persona_id").eq("proyecto_id", proyectoId);
  if (error) throw error;
  const ids = filas.map((f) => f.persona_id);
  if (!ids.length) return [];
  const { data, error: e } = await supabase.from("personas_contacto").select("id, nombre, email").in("id", ids);
  if (e) throw e;
  return data.filter((p): p is typeof p & { id: string; nombre: string } => !!p.id && !!p.nombre).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

// Datos de contacto del mentor: lo que autorizó publicar en Contactos de mentores y, si no, el mail con el que entra.
export async function contactoDelMentor(supabase: Supabase, mentorId: string) {
  const [{ data: persona, error: e1 }, { data: contacto, error: e2 }] = await Promise.all([
    supabase.from("personas_contacto").select("nombre, email").eq("id", mentorId).maybeSingle(),
    supabase.from("austral_contactos_mentores").select("email_contacto, telefono_contacto").eq("mentor_id", mentorId).maybeSingle(),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  return {
    nombre: persona?.nombre ?? "Mentor",
    email: contacto?.email_contacto?.trim() || persona?.email || null,
    telefono: contacto?.telefono_contacto?.trim() || null,
  };
}

async function registrar(supabase: Supabase, fila: { tipo: "mentor" | "equipo"; proyecto_id: string; mentor_id: string; destinatario_id: string; estado: Estado; detalle: string | null; enviado_por: string }) {
  const { error } = await supabase.from("austral_avisos_mentoria").insert(fila);
  if (error) throw error;
}

async function mandar(para: string | null, asunto: string, html: string): Promise<{ estado: Estado; detalle: string | null }> {
  if (!para) return { estado: "sin_email", detalle: "No tiene mail cargado." };
  const r = await enviarCorreo({ para, asunto, html });
  if (!r.ok) return { estado: "error", detalle: r.error };
  return { estado: modoPrueba() ? "simulado" : "enviado", detalle: para };
}

// Mail al mentor avisándole que es titular del proyecto, con los integrantes y sus mails para que los contacte.
export async function avisarAlMentor(supabase: Supabase, proyectoId: string, mentorId: string, adminId: string) {
  const [{ data: proyecto, error }, mentor, equipo] = await Promise.all([
    supabase.from("proyectos").select("nombre").eq("id", proyectoId).single(),
    contactoDelMentor(supabase, mentorId),
    datosDelEquipo(supabase, proyectoId),
  ]);
  if (error) throw error;
  const lista = equipo.length
    ? `<ul>${equipo.map((p) => `<li>${escapar(p.nombre)}${p.email ? ` — ${escapar(p.email)}` : ""}</li>`).join("")}</ul>`
    : "Todavía no tiene integrantes cargados en la plataforma.";
  const resultado = await mandar(mentor.email, `Te asignamos el proyecto ${proyecto.nombre}`, plantilla(`Hola ${mentor.nombre}:`, [
    `Te designamos como <strong>mentor titular</strong> del proyecto <strong>${escapar(proyecto.nombre)}</strong>.`,
    `Integrantes del equipo: ${lista}`,
    "Cuando puedas, escribiles para coordinar la primera reunión. Cualquier duda, respondé este mail.",
  ]));
  await registrar(supabase, { tipo: "mentor", proyecto_id: proyectoId, mentor_id: mentorId, destinatario_id: mentorId, ...resultado, enviado_por: adminId });
  return resultado;
}

// Mail a cada integrante de cada proyecto con titular, avisándole qué mentor le tocó. No repite a quien ya recibió
// (o tuvo simulado) el aviso por ese mismo mentor.
export async function avisarALosEquipos(supabase: Supabase, adminId: string) {
  const [{ data: titulares, error: e1 }, { data: previos, error: e2 }, { data: proyectos, error: e3 }] = await Promise.all([
    supabase.from("austral_titulares_proyecto").select("proyecto_id, mentor_id"),
    supabase.from("austral_avisos_mentoria").select("proyecto_id, mentor_id, destinatario_id").eq("tipo", "equipo").in("estado", ["enviado", "simulado"]),
    supabase.from("proyectos").select("id, nombre"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  if (e3) throw e3;
  const yaAvisados = new Set(previos.map((p) => `${p.proyecto_id}:${p.mentor_id}:${p.destinatario_id}`));
  const nombreProyecto = new Map(proyectos.map((p) => [p.id, p.nombre]));
  const cuenta: Record<Estado, number> & { repetidos: number } = { enviado: 0, simulado: 0, error: 0, sin_email: 0, repetidos: 0 };
  const errores: string[] = [];

  for (const t of titulares) {
    const [mentor, equipo] = await Promise.all([contactoDelMentor(supabase, t.mentor_id), datosDelEquipo(supabase, t.proyecto_id)]);
    const proyecto = nombreProyecto.get(t.proyecto_id) ?? "tu proyecto";
    const contactos = [mentor.email && `mail: ${escapar(mentor.email)}`, mentor.telefono && `teléfono: ${escapar(mentor.telefono)}`].filter(Boolean);
    for (const integrante of equipo) {
      if (yaAvisados.has(`${t.proyecto_id}:${t.mentor_id}:${integrante.id}`)) {
        cuenta.repetidos++;
        continue;
      }
      const resultado = await mandar(integrante.email, `Tu mentor para ${proyecto}`, plantilla(`Hola ${integrante.nombre}:`, [
        `Ya tenemos mentor titular para <strong>${escapar(proyecto)}</strong>: <strong>${escapar(mentor.nombre)}</strong>.`,
        contactos.length ? `Sus datos de contacto: ${contactos.join(" · ")}.` : "En breve se va a comunicar con el equipo.",
        "Te recomendamos coordinar con tu equipo la primera reunión y llegar con las dudas y avances del proyecto.",
      ]));
      cuenta[resultado.estado]++;
      if (resultado.estado === "error" && resultado.detalle) errores.push(resultado.detalle);
      await registrar(supabase, { tipo: "equipo", proyecto_id: t.proyecto_id, mentor_id: t.mentor_id, destinatario_id: integrante.id, ...resultado, enviado_por: adminId });
      await pausa();
    }
  }
  return { cuenta, errores: [...new Set(errores)] };
}
