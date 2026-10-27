// GRUPO JURADO — mail de aviso a cada integrante cuando se publica la devolución de su equipo.
// No incluye notas ni comentarios: solo avisa y lleva a la app, donde el alumno entra con su usuario.
import { boton, esc, marco, parrafo, titulo } from "../comunicaciones/plantillas";

export function mailDevolucion(d: { nombre: string; equipo: string; evento: string; url: string }) {
  return {
    asunto: `Ya está la devolución del jurado de ${d.evento}`,
    html: marco([
      titulo(`Devolución del jurado · ${d.evento}`),
      parrafo(`Hola ${esc(d.nombre)}:`),
      parrafo(`Ya podés ver la devolución del jurado para <strong>${esc(d.equipo)}</strong>: las notas por criterio, cómo entendieron su propuesta de valor y los comentarios.`),
      boton("Ver la devolución", d.url),
      parrafo(`Entrá con tu usuario de Emprendimientos Austral.`),
    ].join("\n")),
  };
}
