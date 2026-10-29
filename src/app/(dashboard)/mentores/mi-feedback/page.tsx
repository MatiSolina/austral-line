// GRUPO MENTORES — "Mi feedback": cada mentor y cada alumno ve acá las encuestas de sus reuniones de mentoría.
// La base solo le deja ver las suyas; lo que contesta lo lee solo el coordinador.
import Link from "next/link";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { urlBase } from "../reuniones/agente";
import { fechaHora } from "../reuniones/fechas";
import { pedirFeedback } from "../feedback/agente";

export default async function MiFeedback() {
  const persona = await requireRol("mentor", "alumno");
  if (persona.rol === "admin") {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="font-serif text-2xl">Mi feedback</h1>
        <div className="mt-10 border p-10 text-center text-sm text-[#666]">
          Esta es la pantalla de mentores y alumnos: cada uno contesta acá cómo le fue en sus reuniones. Las respuestas y los
          resúmenes están en <Link href="/mentores/feedback" className="text-primary underline underline-offset-4">Feedback de reuniones</Link>.
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  // El mentor que entra dispara el pedido de las reuniones suyas que ya terminaron.
  if (persona.rol === "mentor") await pedirFeedback(supabase, await urlBase());
  const { data, error } = await supabase
    .from("mentores_encuestas")
    .select("id, estado, proyecto_nombre, reunion_inicio, con_quien, respondida_at")
    .eq("persona_id", persona.id)
    .order("reunion_inicio", { ascending: false });
  if (error) throw error;
  const pendientes = data.filter((e) => e.estado !== "respondida");
  const respondidas = data.filter((e) => e.estado === "respondida");

  return (
    <div className="mx-auto max-w-3xl">
      {persona.rol === "mentor" && <Link href="/mentores" className="text-sm text-[#666] hover:text-primary">← Mentores</Link>}
      <h1 className="mt-6 font-serif text-2xl">Mi feedback</h1>
      <p className="mt-1 mb-10 text-sm text-[#666]">
        Después de cada reunión de mentoría te preguntamos cómo te fue. Lo que contestás lo lee solo el coordinador de la
        materia: {persona.rol === "mentor" ? "el equipo" : "tu mentor"} no ve tus respuestas.
      </p>

      <section className="mb-12">
        <h2 className="mb-4 font-serif text-xl">Para contestar</h2>
        {pendientes.length === 0 ? (
          <p className="border p-6 text-center text-sm text-[#666]">No tenés encuestas pendientes.</p>
        ) : (
          <div className="grid gap-px border bg-border">
            {pendientes.map((e) => (
              <Link key={e.id} href={`/mentores/mi-feedback/${e.id}`} className="flex flex-wrap items-center justify-between gap-3 bg-background p-5 hover:bg-card">
                <div>
                  <p className="font-medium">{e.proyecto_nombre} · con {e.con_quien}</p>
                  <p className="text-sm text-[#666]">{fechaHora(e.reunion_inicio)}</p>
                </div>
                <span className="text-sm underline underline-offset-4">Contestar</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {respondidas.length > 0 && (
        <section>
          <h2 className="mb-4 font-serif text-xl">Ya contestadas</h2>
          <div className="grid gap-px border bg-border">
            {respondidas.map((e) => (
              <Link key={e.id} href={`/mentores/mi-feedback/${e.id}`} className="flex flex-wrap items-center justify-between gap-3 bg-background p-5 hover:bg-card">
                <div>
                  <p>{e.proyecto_nombre} · con {e.con_quien}</p>
                  <p className="text-sm text-[#666]">{fechaHora(e.reunion_inicio)}</p>
                </div>
                <Badge variant="secondary">Contestada</Badge>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
