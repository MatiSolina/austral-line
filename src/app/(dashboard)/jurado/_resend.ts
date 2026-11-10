// GRUPO JURADO — envío de mails con Resend (https://resend.com/docs/api-reference). Solo se usa desde el servidor.
// Sin RESEND_API_KEY no se manda nada: los mails quedan registrados como "simulado" para poder probar en local.

export type Correo = { para: string; asunto: string; html: string; programadoPara?: string };
type Resultado = { ok: true; ids: (string | null)[] } | { ok: false; error: string };

const API = "https://api.resend.com";

export const modoPrueba = () => !process.env.RESEND_API_KEY;
const remitente = () => process.env.RESEND_FROM || "Emprendimientos Austral <onboarding@resend.dev>";

async function llamar(ruta: string, body?: unknown) {
  const res = await fetch(`${API}${ruta}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "User-Agent": "emprendimientos-austral", // Resend rechaza pedidos sin User-Agent
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const datos = await res.json().catch(() => ({}));
  return { res, datos };
}

function explicarError(status: number, mensaje?: string) {
  if (status === 401 || status === 403) {
    return `Resend rechazó el envío: revisá la clave y que el dominio del remitente esté verificado. (${mensaje ?? status})`;
  }
  if (status === 429) return "Resend está limitando los envíos (demasiados por segundo o cupo diario). Probá de nuevo en un rato.";
  return `Resend respondió con un error: ${mensaje ?? status}`;
}

const armar = (c: Correo) => ({
  from: remitente(),
  to: [c.para],
  subject: c.asunto,
  html: c.html,
  ...(c.programadoPara && { scheduled_at: c.programadoPara }),
});

// Manda en lotes de hasta 100 (límite de Resend). Los envíos en lote de Resend no aceptan horario
// programado, así que los mails programados salen de a uno.
export async function enviarCorreos(correos: Correo[]): Promise<Resultado> {
  if (modoPrueba()) return { ok: true, ids: correos.map(() => null) };
  const ids: string[] = [];
  if (correos.some((c) => c.programadoPara)) {
    for (const [i, c] of correos.entries()) {
      // ponytail: pausa fija para no pasar el límite de 2 pedidos por segundo de Resend.
      if (i) await new Promise((r) => setTimeout(r, 600));
      const { res, datos } = await llamar("/emails", armar(c));
      if (!res.ok) return { ok: false, error: explicarError(res.status, datos?.message) };
      ids.push(datos.id);
    }
    return { ok: true, ids };
  }
  for (let i = 0; i < correos.length; i += 100) {
    const lote = correos.slice(i, i + 100).map(armar);
    const { res, datos } = await llamar("/emails/batch", lote);
    if (!res.ok) return { ok: false, error: explicarError(res.status, datos?.message) };
    ids.push(...(datos.data as { id: string }[]).map((d) => d.id));
  }
  return { ok: true, ids };
}

export async function cancelarCorreo(resendId: string) {
  const { res, datos } = await llamar(`/emails/${resendId}/cancel`);
  return res.ok ? null : explicarError(res.status, datos?.message);
}
