// GRUPO MENTORES — cuando el coordinador acepta un match, les avisa por mail al mentor y a los alumnos del equipo.
// Corre con la sesión del coordinador (admin), que es quien puede ver el mail del mentor.
import type { createClient } from "@/lib/supabase/server";
import { conMail } from "@/lib/supabase/tipos";
import { enviarCorreo, modoPrueba } from "../_resend";
import { mailEquipo, mailMentor } from "./mail";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Devuelve un texto para el coordinador: a cuántos les llegó y qué falló, si algo falló.
export async function avisarAsignacion(supabase: Supabase, proyectoId: string, mentorId: string, url: string) {
  const [proyecto, mentor, perfil, integrantes] = await Promise.all([
    supabase.from("proyectos").select("nombre, descripcion").eq("id", proyectoId).single(),
    supabase.from("personas_contacto").select("nombre, email").eq("id", mentorId).single(),
    supabase.from("mentores_perfil").select("cargo, empresa, areas_ayuda, estado").eq("persona_id", mentorId).maybeSingle(),
    supabase.from("proyecto_integrantes").select("personas:personas_contacto(nombre, email, rol)").eq("proyecto_id", proyectoId),
  ]);
  for (const r of [proyecto, mentor, perfil, integrantes]) if (r.error) throw r.error;

  // A los alumnos solo les llega lo que el mentor ya publicó: un borrador todavía no es para mostrar.
  const publicado = perfil.data?.estado === "publicado" ? perfil.data : null;
  const alumnos = integrantes.data!.map((i) => i.personas).filter((p) => p.rol === "alumno");
  const datos = {
    proyecto: proyecto.data!,
    mentor: { nombre: mentor.data!.nombre, cargo: publicado?.cargo ?? null, empresa: publicado?.empresa ?? null, areas_ayuda: publicado?.areas_ayuda ?? null },
    integrantes: alumnos.map((a) => a.nombre),
  };

  const envios = [
    ...(mentor.data!.email ? [{ para: mentor.data!.email, ...mailMentor(datos, url) }] : []),
    ...alumnos.filter(conMail).map((a) => ({ para: a.email, ...mailEquipo({ ...datos, nombre: a.nombre }, url) })),
  ];
  const fallas: string[] = [];
  for (const e of envios) {
    const r = await enviarCorreo(e);
    if (!r.ok) fallas.push(r.error);
  }

  const llegaron = envios.length - fallas.length;
  const texto = envios.length === 0
    ? "No se mandó ningún aviso: ni el mentor ni el equipo tienen mail cargado."
    : `Les avisamos por mail al mentor y al equipo (${llegaron} de ${envios.length}).${fallas.length ? ` No se pudo mandar el resto: ${fallas[0]}` : ""}`;
  return modoPrueba() ? `Simulado (falta la clave de Resend, no salió ningún mail): ${texto}` : texto;
}
