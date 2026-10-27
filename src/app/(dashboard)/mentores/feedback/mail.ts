// GRUPO MENTORES — mails del feedback post reunión. Mismo diseño que el resumen pre-reunión.
import { boton, esc, lista, marco, multilinea, nota, parrafo, subtitulo, titulo } from "../reuniones/mail";
import { fechaCorta, fechaHora } from "../reuniones/fechas";

type Pedido = { id: string; nombre: string; con_quien: string; proyecto_nombre: string; reunion_inicio: string };

export function mailPedido(e: Pedido, url: string, { recordatorio = false } = {}) {
  const asunto = `${recordatorio ? "Recordatorio: " : ""}¿Cómo te fue en la reunión con ${e.con_quien}? · ${fechaCorta(e.reunion_inicio)}`;
  const html = marco([
    titulo(recordatorio ? "Te queda una pregunta pendiente" : "¿Cómo te fue en la reunión?"),
    parrafo(`Hola ${esc(e.nombre)}, queremos saber cómo te fue en la reunión de mentoría de <strong>${esc(e.proyecto_nombre)}</strong> con ${esc(e.con_quien)} (${esc(fechaHora(e.reunion_inicio))}).`),
    parrafo("Son tres preguntas y lleva un minuto."),
    boton("Contar cómo me fue", `${url}/mentores/mi-feedback/${e.id}`),
    nota(`Lo que contestes lo lee solo el coordinador de la materia: ${esc(e.con_quien)} no ve tus respuestas.${recordatorio ? " Este es el único recordatorio que te mandamos." : ""}`),
  ].join("\n"));
  return { asunto, html };
}

type Urgente = {
  papel: string;
  nombre: string;
  proyecto_nombre: string;
  reunion_inicio: string;
  motivo: string | null;
  urgente: string | null;
  comentarios: string[];
};

// Para el coordinador cuando una respuesta trae algo grave: va directo, sin esperar al resumen.
export function mailUrgente(e: Urgente, url: string) {
  const asunto = `Atención: feedback de la reunión de ${e.proyecto_nombre} · ${fechaCorta(e.reunion_inicio)}`;
  const html = marco([
    titulo("Un feedback necesita tu atención"),
    parrafo(`${esc(e.nombre)} (${e.papel === "mentor" ? "mentor" : "alumno"}) contestó el feedback de la reunión de <strong>${esc(e.proyecto_nombre)}</strong> del ${esc(fechaHora(e.reunion_inicio))}.`),
    ...(e.motivo ? [subtitulo("Por qué te avisamos"), parrafo(multilinea(e.motivo))] : []),
    ...(e.urgente ? [subtitulo("Lo que pidió que sepas"), parrafo(multilinea(e.urgente))] : []),
    ...(e.comentarios.length ? [subtitulo("Sus comentarios"), lista(e.comentarios.map(multilinea))] : []),
    boton("Ver el feedback de reuniones", `${url}/mentores/feedback`),
    nota("Te avisa el asistente de Mentores. La otra persona de la reunión no ve esta respuesta."),
  ].join("\n"));
  return { asunto, html };
}
