// GRUPO MENTORES — mails de cuando el coordinador acepta un match. Mismo diseño que el resumen pre-reunión.
import { boton, esc, marco, multilinea, nota, parrafo, subtitulo, titulo } from "../reuniones/mail";

type Asignacion = {
  proyecto: { nombre: string; descripcion: string | null };
  mentor: { nombre: string; cargo: string | null; empresa: string | null; areas_ayuda: string | null };
  integrantes: string[];
};

const cargoYEmpresa = (m: Asignacion["mentor"]) => [m.cargo, m.empresa].filter(Boolean).join(" en ");

export function mailMentor(a: Asignacion, url: string) {
  const asunto = `Te asignaron un proyecto: ${a.proyecto.nombre}`;
  const html = marco([
    titulo(`Vas a acompañar a ${a.proyecto.nombre}`),
    parrafo(`Hola ${esc(a.mentor.nombre)}, el coordinador de la materia te asignó como mentor de <strong>${esc(a.proyecto.nombre)}</strong>.`),
    ...(a.proyecto.descripcion ? [subtitulo("De qué se trata"), parrafo(multilinea(a.proyecto.descripcion))] : []),
    ...(a.integrantes.length ? [subtitulo("El equipo"), parrafo(esc(a.integrantes.join(", ")))] : []),
    parrafo("Cuando acuerden la primera reunión, cargala en la app: 24 h antes te llega un resumen para ir preparado."),
    boton("Agendar una reunión", `${url}/mentores/reuniones`),
  ].join("\n"));
  return { asunto, html };
}

export function mailEquipo(a: Asignacion & { nombre: string }, url: string) {
  const asunto = `Ya tienen mentor: ${a.mentor.nombre}`;
  const quien = cargoYEmpresa(a.mentor);
  const html = marco([
    titulo("Ya tienen mentor"),
    parrafo(`Hola ${esc(a.nombre)}, el coordinador de la materia le asignó a <strong>${esc(a.proyecto.nombre)}</strong> un mentor: <strong>${esc(a.mentor.nombre)}</strong>${quien ? ` (${esc(quien)})` : ""}.`),
    ...(a.mentor.areas_ayuda ? [subtitulo("En qué los puede ayudar"), parrafo(multilinea(a.mentor.areas_ayuda))] : []),
    parrafo("Se va a poner en contacto con ustedes para acordar la primera reunión."),
    boton("Entrar a la app", url),
    nota("Después de cada reunión les vamos a preguntar cómo les fue: lo que contesten lo lee solo el coordinador."),
  ].join("\n"));
  return { asunto, html };
}
