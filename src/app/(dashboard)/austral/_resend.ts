// GRUPO AUSTRAL — envío de mails con Resend (https://resend.com/docs/api-reference). Solo se usa desde el servidor.
// Sin RESEND_API_KEY no se manda nada: el aviso queda registrado como "simulado" para poder probar en local.

export type Correo = { para: string; asunto: string; html: string };
type Resultado = { ok: true; id: string | null } | { ok: false; error: string };

export const modoPrueba = () => !process.env.RESEND_API_KEY;
const remitente = () => process.env.RESEND_FROM || "Emprendimientos Austral <onboarding@resend.dev>";

function explicarError(status: number, mensaje?: string) {
  if (status === 401 || status === 403) {
    return `Resend rechazó el envío: revisá la clave y que el dominio del remitente esté verificado. (${mensaje ?? status})`;
  }
  if (status === 429) return "Resend está limitando los envíos (demasiados por segundo o cupo diario). Probá de nuevo en un rato.";
  return `Resend respondió con un error: ${mensaje ?? status}`;
}

export async function enviarCorreo(c: Correo): Promise<Resultado> {
  if (modoPrueba()) return { ok: true, id: null };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "User-Agent": "emprendimientos-austral", // Resend rechaza pedidos sin User-Agent
      },
      body: JSON.stringify({ from: remitente(), to: [c.para], subject: c.asunto, html: c.html }),
    });
    const datos = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: explicarError(res.status, datos?.message) };
    return { ok: true, id: datos.id ?? null };
  } catch (e) {
    return { ok: false, error: `No se pudo conectar con Resend (${e instanceof Error ? e.message : "error"}).` };
  }
}

// Resend acepta pocos mails por segundo: entre envíos reales se espera un poco.
export const pausa = () => (modoPrueba() ? Promise.resolve() : new Promise((r) => setTimeout(r, 600)));

export const escapar = (texto: string) =>
  texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
