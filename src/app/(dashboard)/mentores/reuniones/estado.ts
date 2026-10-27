// GRUPO MENTORES — en qué está el resumen de cada reunión y las métricas del agente (las usan las pantallas y el agente).
import { fechaCorta } from "./fechas";

const HORA = 60 * 60 * 1000;
export const ANTICIPACION = 24 * HORA;
export const LIMITE_RESEND = 30 * 24 * HORA; // Resend programa mails hasta 30 días antes
const ACTIVOS = ["programado", "simulado", "enviado"];

type ResumenBase = { estado: string; programado_para: string | null; created_at: string };

// El resumen que cuenta para una reunión: el último que no fue reemplazado, cancelado ni falló.
export function vigente<T extends { estado: string; created_at: string }>(resumenes: T[]) {
  return resumenes.filter((r) => ACTIVOS.includes(r.estado)).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

// Ya le llegó al mentor (en modo prueba: ya le habría llegado). Un resumen que ya salió no se rehace.
export const yaSalio = (r: { estado: string; programado_para: string | null }, ahora = Date.now()) =>
  ACTIVOS.includes(r.estado) && (!r.programado_para || new Date(r.programado_para).getTime() <= ahora);

// Falta tanto para la reunión que Resend todavía no deja programar el mail.
export const enEspera = (inicio: string, ahora = Date.now()) =>
  new Date(inicio).getTime() - ANTICIPACION - ahora > LIMITE_RESEND;

export type Tono = "ok" | "pendiente" | "error" | "neutro";

export function estadoResumen(
  reunion: { inicio: string; cancelada: boolean },
  resumenes: (ResumenBase & { leido_at: string | null })[],
  ahora = Date.now(),
): { texto: string; tono: Tono } {
  if (reunion.cancelada) return { texto: "Cancelada", tono: "neutro" };
  const actual = vigente(resumenes);
  const simulado = actual?.estado === "simulado" ? " (simulado)" : "";
  if (actual && yaSalio(actual, ahora)) return { texto: `${actual.leido_at ? "Enviado y leído" : "Enviado"}${simulado}`, tono: "ok" };
  if (actual) return { texto: `Sale el ${fechaCorta(actual.programado_para!)}${simulado}`, tono: "pendiente" };
  if (resumenes.some((r) => r.estado === "error")) return { texto: "Falló el envío", tono: "error" };
  if (new Date(reunion.inicio).getTime() <= ahora) return { texto: "Sin resumen", tono: "neutro" };
  if (enEspera(reunion.inicio, ahora)) return { texto: "Se programa más adelante", tono: "neutro" };
  return { texto: "Pendiente", tono: "pendiente" };
}

// Métricas del relevamiento: reuniones con resumen a tiempo, si lo leen y si el asistente escaló bien los problemas.
export function metricas(
  reuniones: { inicio: string; cancelada: boolean; mentores_resumenes: (ResumenBase & { leido_at: string | null; aviso: string | null; aviso_util: boolean | null })[] }[],
  ahora = Date.now(),
) {
  // Las que ya tendrían que tener resumen: no canceladas y con la ventana de 24 h ya empezada.
  const debian = reuniones.filter((r) => !r.cancelada && new Date(r.inicio).getTime() - ANTICIPACION <= ahora);
  const salieron = debian.map((r) => {
    const v = vigente(r.mentores_resumenes);
    const salio = !!v && yaSalio(v, ahora) && new Date(v.programado_para ?? v.created_at).getTime() <= new Date(r.inicio).getTime();
    return salio ? v : null;
  }).filter((v) => v !== null);
  const conAviso = reuniones.map((r) => vigente(r.mentores_resumenes)).filter((v) => !!v?.aviso);
  return {
    aTiempo: salieron.length,
    debian: debian.length,
    leidos: salieron.filter((v) => v.leido_at).length,
    avisos: conAviso.length,
    avisosUtiles: conAviso.filter((v) => v.aviso_util === true).length,
    avisosMarcados: conAviso.filter((v) => v.aviso_util !== null).length,
  };
}
