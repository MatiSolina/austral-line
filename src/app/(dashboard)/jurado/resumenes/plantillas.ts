// GRUPO JURADO — textos de los mails del resumen del pitch. Mismo diseño que los de "Mails a jurados".
import { boton, esc, fechaHora, marco, parrafo, titulo } from "../comunicaciones/plantillas";

type Evento = { nombre: string; inicio: string };

const lista = (items: string[]) =>
  `<ul style="margin:0 0 12px;padding-left:20px;font-size:15px;line-height:1.6">${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
const nota = (texto: string) => parrafo(`<span style="color:#666;font-size:13px">${texto}</span>`);

// A cada jurado, el día anterior a las 18:00: link a los resúmenes de los equipos de su salón.
export function mailEntrega(datos: { jurado: string; evento: Evento; salon: string; equipos: string[]; url: string }) {
  const { jurado, evento, salon, equipos, url } = datos;
  const asunto = `Resumen del pitch para ${evento.nombre}`;
  const html = marco([
    titulo("Tu resumen del pitch ya está listo"),
    parrafo(`Hola ${esc(jurado)}, para que llegues informado a ${esc(evento.nombre)} (${esc(fechaHora(evento.inicio))}) preparamos un resumen de cada equipo de tu salón (${esc(salon)}), armado con su presentación final y la sesión grabada del pitch.`),
    lista(equipos.map(esc)),
    boton("Leer o escuchar los resúmenes", `${url}/jurado/resumen-pitch`),
    nota("Podés leerlo o escucharlo, como prefieras: todo el salón se escucha en menos de 15 minutos. El resumen no incluye opiniones ni notas; la evaluación es tuya."),
  ].join("\n"));
  return { asunto, html };
}

// A los admins, en el momento en que el agente frena: el reporte de escalamiento (equipo, error, archivos recibidos).
export function mailAlerta(datos: { evento: Evento; equipo: string; reporte: string; link: string }) {
  const { evento, equipo, reporte, link } = datos;
  const asunto = `Resumen del pitch: el agente frenó con ${equipo}`;
  const html = marco([
    titulo(`Falta resolver el resumen de ${equipo}`),
    parrafo(`El agente del resumen del pitch frenó al preparar el material de <strong>${esc(equipo)}</strong> para ${esc(evento.nombre)}. Este es su reporte:`),
    `<pre style="margin:0 0 12px;padding:12px;background:#f4f4f4;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;white-space:pre-wrap">${esc(reporte)}</pre>`,
    boton("Revisar el material", link),
    nota("Los jurados reciben los resúmenes el día anterior al evento a las 18:00: conviene resolverlo antes."),
  ].join("\n"));
  return { asunto, html };
}
