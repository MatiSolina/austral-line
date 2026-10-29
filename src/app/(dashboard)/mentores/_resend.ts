// GRUPO MENTORES — envío de mails con Resend (https://resend.com/docs/api-reference). Solo se usa desde el servidor.
// Sin RESEND_API_KEY no se manda nada: los mails quedan registrados como "simulado" para poder probar en local.

export type Correo = { para: string; asunto: string; html: string; programadoPara?: string };
type Resultado = { ok: true; id: string | null } | { ok: false; error: string };

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

// Manda un mail, o lo deja programado si tiene horario (Resend programa hasta 30 días antes).
export async function enviarCorreo(c: Correo): Promise<Resultado> {
  if (modoPrueba()) return { ok: true, id: null };
  const { res, datos } = await llamar("/emails", {
    from: remitente(),
    to: [c.para],
    subject: c.asunto,
    html: c.html,
    ...(c.programadoPara && { scheduled_at: c.programadoPara }),
  });
  if (!res.ok) return { ok: false, error: explicarError(res.status, datos?.message) };
  return { ok: true, id: datos.id ?? null };
}

export async function cancelarCorreo(resendId: string) {
  if (modoPrueba()) return null;
  const { res, datos } = await llamar(`/emails/${resendId}/cancel`);
  return res.ok ? null : explicarError(res.status, datos?.message);
}
