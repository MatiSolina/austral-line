// GRUPO JURADO — textos de los mails a jurados. Los mails no entienden las clases de la app: van con estilos en línea.

const zona = "America/Argentina/Buenos_Aires";

export const fechaHora = (iso: string) =>
  new Intl.DateTimeFormat("es-AR", {
    timeZone: zona, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(iso)) + " hs";

// 9:00 del día siguiente al evento, hora argentina (Argentina no tiene horario de verano: siempre UTC-3).
export function diaSiguienteALas9(inicio: string) {
  const [dia, mes, anio] = new Intl.DateTimeFormat("en-GB", { timeZone: zona, day: "2-digit", month: "2-digit", year: "numeric" })
    .format(new Date(inicio))
    .split("/");
  const fecha = new Date(`${anio}-${mes}-${dia}T09:00:00-03:00`);
  fecha.setUTCDate(fecha.getUTCDate() + 1);
  return fecha.toISOString();
}

const esImagen = (link: string) => /\.(jpe?g|png|gif|webp)(\?.*)?$/i.test(link);

export const esc = (texto: string) =>
  texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const titulo = (t: string) => `<h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:24px;font-weight:normal">${esc(t)}</h1>`;
const subtitulo = (t: string) => `<h2 style="margin:28px 0 8px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#666">${esc(t)}</h2>`;
export const parrafo = (html: string) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${html}</p>`;
export const boton = (texto: string, url: string) =>
  `<p style="margin:24px 0"><a href="${esc(url)}" style="display:inline-block;padding:12px 20px;background:#121212;color:#ffffff;text-decoration:none;font-size:14px">${esc(texto)}</a></p>`;
const lista = (items: string[]) =>
  `<ul style="margin:0 0 12px;padding-left:20px;font-size:15px;line-height:1.6">${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;

export const marco = (contenido: string) => `<!doctype html><html><body style="margin:0;padding:24px 0;background:#f4f4f4;font-family:Helvetica,Arial,sans-serif;color:#121212">
<div style="max-width:560px;margin:0 auto;padding:32px 28px;background:#ffffff;border:1px solid #e6e6e6">
${contenido}
<p style="margin:32px 0 0;padding-top:16px;border-top:1px solid #e6e6e6;font-size:12px;color:#666">Emprendimientos · Universidad Austral</p>
</div></body></html>`;

type Evento = { nombre: string; inicio: string; lugar: string | null };

export function mailRecordatorio(datos: {
  tipo: "recordatorio_24h" | "recordatorio_1h";
  jurado: string;
  evento: Evento;
  proyectos: { id: string; nombre: string; descripcion: string | null }[];
  criterios: string[];
  url: string;
}) {
  const { tipo, jurado, evento, proyectos, criterios, url } = datos;
  const cuando = tipo === "recordatorio_24h" ? "Mañana" : "En 1 hora";
  const asunto = `${cuando}: ${evento.nombre}${evento.lugar ? ` en ${evento.lugar}` : ""}`;
  const html = marco([
    titulo(`${cuando} es ${evento.nombre}`),
    parrafo(`Hola ${esc(jurado)}, te recordamos que vas a ser jurado:`),
    lista([
      `<strong>Cuándo:</strong> ${esc(fechaHora(evento.inicio))}`,
      ...(evento.lugar ? [`<strong>Dónde:</strong> ${esc(evento.lugar)}`] : []),
    ]),
    subtitulo(`Proyectos que vas a evaluar (${proyectos.length})`),
    lista(proyectos.map((p) =>
      `<a href="${esc(`${url}/jurado/fichas/${p.id}`)}" style="color:#121212">${esc(p.nombre)}</a>${p.descripcion ? ` — ${esc(p.descripcion)}` : ""}`)),
    subtitulo("Criterios de evaluación (de 1 a 10)"),
    lista(criterios.map(esc)),
    boton("Ver fichas y planilla", `${url}/jurado`),
    parrafo(`<span style="color:#666;font-size:13px">En la planilla vas a poder puntuar cada proyecto durante el pitch y ajustar tus notas antes de la deliberación.</span>`),
  ].join("\n"));
  return { asunto, html };
}

export function mailPostEvento(datos: {
  jurado: string;
  evento: Evento;
  fotos: string[];
  video: string;
  mensaje: string | null;
  equipos: { nombre: string; integrantes: { nombre: string; email: string }[] }[];
}) {
  const { jurado, evento, fotos, video, mensaje, equipos } = datos;
  const asunto = `¡Gracias por ser jurado de ${evento.nombre}! Fotos, video y contactos de los equipos`;
  const html = marco([
    titulo(`Gracias por acompañarnos en ${evento.nombre}`),
    parrafo(`Hola ${esc(jurado)}, gracias por tu tiempo y tu mirada. Te compartimos lo mejor del evento y cómo contactar a cada equipo.`),
    ...(mensaje ? [parrafo(esc(mensaje).replace(/\n/g, "<br>"))] : []),
    subtitulo("Fotos destacadas"),
    fotos.map((f, i) => esImagen(f)
      ? `<p style="margin:0 0 12px"><a href="${esc(f)}"><img src="${esc(f)}" alt="Foto ${i + 1}" width="504" style="display:block;width:100%;height:auto;border:0"></a></p>`
      : parrafo(`<a href="${esc(f)}" style="color:#121212">Ver foto ${i + 1}</a>`)).join("\n"),
    subtitulo("Video resumen"),
    boton("Ver el video", video),
    subtitulo("Contactos de los equipos"),
    ...equipos.map((e) =>
      parrafo(`<strong>${esc(e.nombre)}</strong><br>${e.integrantes
        .map((i) => `${esc(i.nombre)} · <a href="mailto:${esc(i.email)}" style="color:#121212">${esc(i.email)}</a>`)
        .join("<br>")}`)),
  ].join("\n"));
  return { asunto, html };
}
