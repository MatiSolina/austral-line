// GRUPO MENTORES — tiempos del feedback post reunión y métricas del agente (las usan las pantallas y el agente).

const HORA = 60 * 60 * 1000;
export const DURACION = 1 * HORA;           // una reunión se da por terminada 1 h después de empezar
export const VENTANA = 14 * 24 * HORA;      // solo se pide feedback de reuniones que terminaron hace menos de 14 días
export const RECORDATORIO = 48 * HORA;      // a las 48 h sin respuesta, un único recordatorio
export const SIN_RESPUESTA = 5 * 24 * HORA; // a los 5 días se deja de esperar y se avisa al coordinador

export const termino = (inicio: string, ahora = Date.now()) => new Date(inicio).getTime() + DURACION <= ahora;

export const puntajes: Record<number, string> = {
  1: "Nada útil",
  2: "Poco útil",
  3: "Más o menos",
  4: "Útil",
  5: "Muy útil",
};

type Encuesta = { estado: string; created_at: string; respondida_at: string | null; puntaje: number | null };

const mediana = (valores: number[]) => {
  if (!valores.length) return null;
  const v = [...valores].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

// Métricas del relevamiento: % que responde, cuánto tardan en responder y calidad del resumen final.
export function metricas(encuestas: Encuesta[], resumenes: { util: boolean | null }[]) {
  const respondidas = encuestas.filter((e) => e.estado === "respondida");
  const horas = respondidas
    .filter((e) => e.respondida_at)
    .map((e) => (new Date(e.respondida_at!).getTime() - new Date(e.created_at).getTime()) / HORA);
  const conPuntaje = respondidas.filter((e) => e.puntaje != null);
  const marcados = resumenes.filter((r) => r.util !== null);
  return {
    pedidas: encuestas.length,
    respondidas: respondidas.length,
    porcentaje: encuestas.length ? Math.round((respondidas.length / encuestas.length) * 100) : null,
    medianaHoras: mediana(horas),
    puntaje: conPuntaje.length ? conPuntaje.reduce((s, e) => s + e.puntaje!, 0) / conPuntaje.length : null,
    resumenes: resumenes.length,
    utiles: marcados.filter((r) => r.util).length,
    marcados: marcados.length,
  };
}

export const tiempo = (horas: number | null) =>
  horas == null ? "—" : horas < 1 ? "< 1 h" : horas < 48 ? `${Math.round(horas)} h` : `${Math.round(horas / 24)} días`;
