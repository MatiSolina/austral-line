import { createAdminClient } from "@/lib/supabase/admin";
import { ponerAlDia, urlBase } from "@/app/(dashboard)/mentores/reuniones/agente";
import { pedirFeedback, ponerAlDia as ponerAlDiaFeedback } from "@/app/(dashboard)/mentores/feedback/agente";

// Cron diario de Vercel (vercel.json): arma los resúmenes pre-reunión que falten (#27) y mueve el feedback
// post reunión (pedirlo, el recordatorio, cerrar lo que quedó sin respuesta y armar los resúmenes), para que
// no dependa de que un mentor o el coordinador entre a la app.
// Sin sesión, así que usa el cliente admin; solo entra Vercel con CRON_SECRET.
// ponytail: cada paso hace hasta 3 por vuelta; si un día faltan más, se ponen al día en los siguientes.
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("No autorizado", { status: 401 });
  }
  const supabase = createAdminClient();
  const url = await urlBase();
  await ponerAlDia(supabase, url);
  const pedidas = await pedirFeedback(supabase, url);
  await ponerAlDiaFeedback(supabase, url);
  return Response.json({ ok: true, encuestasPedidas: pedidas });
}
