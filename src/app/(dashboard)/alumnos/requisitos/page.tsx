// GRUPO ALUMNOS — "Requisitos": preguntas sobre la materia. El alumno pregunta y la IA responde solo con el
// reglamento y las consignas que cargaron los profesores, citando de dónde sale; si no está, la pregunta pasa
// a los profesores, que la contestan acá. Los profesores cargan el reglamento y contestan las derivadas.
import { Suspense } from "react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { BotonEnviar } from "./_components/boton-enviar";
import { contestar, derivar, guardarReglamento, preguntar } from "./_acciones";

// La IA tarda unos segundos (con un máximo de 30).
export const maxDuration = 60;

const ZONA = "America/Argentina/Buenos_Aires";
const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: ZONA });
const campo = "border bg-background px-2.5 py-2 text-sm outline-none focus-visible:border-ring";

const ESTADO: Record<string, string> = {
  pendiente: "Respondiendo…",
  respondida: "Respondida por la IA",
  derivada: "Esperando a los profesores",
  error: "Esperando a los profesores",
  contestada: "Contestada por los profesores",
};

async function Aviso({ searchParams }: Pick<PageProps<"/alumnos/requisitos">, "searchParams">) {
  const { error, ok } = await searchParams;
  if (error) return <p className="mb-6 border bg-card px-4 py-3 text-sm text-destructive">{String(error)}</p>;
  if (ok) return <p className="mb-6 border bg-card px-4 py-3 text-sm">{String(ok)}</p>;
  return null;
}

type Pregunta = {
  id: string;
  pregunta: string;
  estado: string;
  respuesta_ia: string | null;
  cita: string | null;
  respuesta_profesores: string | null;
  created_at: string;
};

function Respuesta({ p }: { p: Pregunta }) {
  if (p.estado === "contestada") {
    return (
      <div className="grid gap-1">
        <span className="text-xs font-medium text-primary">Profesores</span>
        <p className="whitespace-pre-line">{p.respuesta_profesores}</p>
      </div>
    );
  }
  if (p.estado === "respondida") {
    return (
      <div className="grid gap-2">
        <p className="whitespace-pre-line">{p.respuesta_ia}</p>
        <blockquote className="border-l-2 pl-3 text-xs text-[#666]">Del reglamento: “{p.cita}”</blockquote>
      </div>
    );
  }
  return null;
}

export default async function Requisitos({ searchParams }: PageProps<"/alumnos/requisitos">) {
  const persona = await requireRol("alumno");
  const esProfesor = persona.rol === "admin";
  const supabase = await createClient();
  const titulo = <h1 className="mb-2 font-serif text-2xl">Requisitos</h1>;

  if (!esProfesor) {
    const [preguntas, hoy, limite, reglamento] = await Promise.all([
      supabase.from("alumnos_preguntas").select("id, pregunta, estado, respuesta_ia, cita, respuesta_profesores, created_at").order("created_at", { ascending: false }),
      supabase.rpc("alumnos_preguntas_hoy"),
      supabase.rpc("alumnos_preguntas_limite"),
      supabase.from("alumnos_reglamento").select("updated_at, texto").eq("id", 1).maybeSingle(),
    ]);
    for (const r of [preguntas, hoy, limite, reglamento]) if (r.error) throw r.error;
    const restantes = Math.max(0, (limite.data ?? 0) - (hoy.data ?? 0));
    const hayReglamento = !!reglamento.data?.texto.trim();

    return (
      <>
        {titulo}
        <p className="mb-6 max-w-2xl text-sm text-[#666]">
          Preguntá lo que necesites sobre requisitos, entregas, fechas o reglas de la materia. La IA responde solo con el
          reglamento y las consignas oficiales, y te muestra de dónde lo sacó. Si no está ahí, tu pregunta les llega a los
          profesores y te contestan acá.
        </p>
        <Suspense><Aviso searchParams={searchParams} /></Suspense>

        <div className="grid max-w-3xl gap-6">
          <form action={preguntar} className="grid gap-3 border bg-card p-6">
            <Label htmlFor="pregunta">Tu pregunta</Label>
            <textarea id="pregunta" name="pregunta" required minLength={5} maxLength={1000} rows={3} placeholder="Por ejemplo: ¿la entrega del Demo Day es grupal o individual?" className={campo} />
            <div className="flex flex-wrap items-center gap-3">
              <BotonEnviar size="sm" disabled={restantes === 0} enviando="Buscando en el reglamento…">Preguntar</BotonEnviar>
              <span className="text-xs text-[#666]">
                {restantes === 0 ? "Ya hiciste las preguntas de hoy. Mañana podés hacer más." : `Te quedan ${restantes} por hoy.`}
                {!hayReglamento && " Los profesores todavía no cargaron el reglamento: por ahora tus preguntas les llegan directo a ellos."}
              </span>
            </div>
          </form>

          <section className="grid gap-3">
            <h2 className="font-serif text-lg">Tus preguntas</h2>
            {preguntas.data!.length === 0 && <p className="text-sm text-[#666]">Todavía no hiciste ninguna pregunta.</p>}
            {preguntas.data!.map((p) => (
              <article key={p.id} className="grid gap-3 border bg-card p-5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{p.pregunta}</span>
                  <Badge variant={p.estado === "respondida" || p.estado === "contestada" ? "default" : "outline"} className="ml-auto">
                    {ESTADO[p.estado] ?? p.estado}
                  </Badge>
                </div>
                <span className="text-xs text-[#666]">{fechaHora(p.created_at)}</span>
                <Respuesta p={p} />
                {p.estado === "respondida" && (
                  <form action={derivar}>
                    <input type="hidden" name="pregunta_id" value={p.id} />
                    <button type="submit" className="text-xs text-[#666] underline underline-offset-4 hover:text-primary">
                      ¿No te sirvió? Pasásela a los profesores
                    </button>
                  </form>
                )}
              </article>
            ))}
          </section>
        </div>
      </>
    );
  }

  // Vista de los profesores ---------------------------------------------------------------------
  const [reglamento, derivadas, recientes] = await Promise.all([
    supabase.from("alumnos_reglamento").select("texto, updated_at").eq("id", 1).maybeSingle(),
    supabase
      .from("alumnos_preguntas")
      .select("id, pregunta, estado, respuesta_ia, cita, respuesta_profesores, created_at, quien:personas!alumnos_preguntas_persona_id_fkey(nombre)")
      .in("estado", ["derivada", "error"])
      .order("created_at"),
    supabase
      .from("alumnos_preguntas")
      .select("id, pregunta, estado, respuesta_ia, cita, respuesta_profesores, created_at, quien:personas!alumnos_preguntas_persona_id_fkey(nombre)")
      .in("estado", ["respondida", "contestada"])
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  for (const r of [reglamento, derivadas, recientes]) if (r.error) throw r.error;

  return (
    <>
      {titulo}
      <p className="mb-6 max-w-2xl text-sm text-[#666]">
        Cargá el reglamento y las consignas de la materia: la IA responde las preguntas de los alumnos solo con este texto.
        Lo que no está o es ambiguo te llega abajo para que lo contestes.
      </p>
      <Suspense><Aviso searchParams={searchParams} /></Suspense>

      <div className="grid max-w-3xl gap-8">
        <section className="grid gap-3">
          <h2 className="font-serif text-lg">Preguntas para contestar ({derivadas.data!.length})</h2>
          {derivadas.data!.length === 0 && <p className="text-sm text-[#666]">No hay preguntas esperando respuesta.</p>}
          {derivadas.data!.map((p) => (
            <article key={p.id} className="grid gap-3 border bg-card p-5 text-sm">
              <p><span className="font-medium">{p.quien?.nombre ?? "Un alumno"}</span> pregunta: {p.pregunta}</p>
              <span className="text-xs text-[#666]">
                {fechaHora(p.created_at)}
                {p.estado === "error" ? " · La IA no pudo responder." : p.respuesta_ia ? " · La respuesta de la IA no le sirvió." : " · No está en el reglamento."}
              </span>
              {p.respuesta_ia && <p className="border-l-2 pl-3 text-[#666]">La IA había dicho: {p.respuesta_ia}</p>}
              <form action={contestar} className="grid gap-2">
                <input type="hidden" name="pregunta_id" value={p.id} />
                <textarea name="respuesta" required minLength={2} maxLength={3000} rows={3} aria-label="Respuesta" className={campo} />
                <div><BotonEnviar size="sm" enviando="Enviando…">Contestar</BotonEnviar></div>
              </form>
            </article>
          ))}
        </section>

        <section className="grid gap-3 border bg-card p-6">
          <h2 className="font-serif text-lg">Reglamento y consignas</h2>
          <form action={guardarReglamento} className="grid gap-3">
            <textarea
              name="texto"
              rows={14}
              maxLength={60000}
              defaultValue={reglamento.data?.texto ?? ""}
              placeholder="Pegá acá el reglamento de la materia, las condiciones para regularizar y las consignas de cada entrega."
              aria-label="Reglamento y consignas"
              className={campo}
            />
            <div className="flex flex-wrap items-center gap-3">
              <BotonEnviar size="sm" variant="outline" enviando="Guardando…">Guardar</BotonEnviar>
              {reglamento.data?.updated_at && <span className="text-xs text-[#666]">Actualizado el {fechaHora(reglamento.data.updated_at)}.</span>}
            </div>
          </form>
        </section>

        <section className="grid gap-3">
          <h2 className="font-serif text-lg">Últimas respuestas</h2>
          {recientes.data!.length === 0 && <p className="text-sm text-[#666]">Todavía no hay preguntas respondidas.</p>}
          {recientes.data!.map((p) => (
            <article key={p.id} className="grid gap-2 border bg-card p-5 text-sm">
              <p><span className="font-medium">{p.quien?.nombre ?? "Un alumno"}</span>: {p.pregunta}</p>
              <span className="text-xs text-[#666]">{fechaHora(p.created_at)} · {ESTADO[p.estado]}</span>
              <Respuesta p={p} />
            </article>
          ))}
        </section>
      </div>
    </>
  );
}
