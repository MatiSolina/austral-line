// GRUPO ALUMNOS — "Competencia": el grupo completa un breve de su proyecto y la IA busca en internet
// competidores y alternativas, con diferenciales, alertas y preguntas que desafían la propuesta.
// Lo ven el grupo, su mentor asignado y los profesores; analizar, solo el grupo (hasta 3 veces por día).
import { Suspense } from "react";
import Link from "next/link";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { BotonEnviar } from "./_components/boton-enviar";
import { Analisis } from "./_components/analisis";
import { analizar, guardarBreve } from "./_acciones";
import { hayIA, type Resultado } from "./_agente";

// El análisis busca en internet y tarda alrededor de un minuto.
export const maxDuration = 120;

const ZONA = "America/Argentina/Buenos_Aires";
const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: ZONA });
const campo = "border bg-background px-2.5 py-2 text-sm outline-none focus-visible:border-ring";

async function Aviso({ searchParams }: Pick<PageProps<"/alumnos/competencia">, "searchParams">) {
  const { error, ok } = await searchParams;
  if (error) return <p className="mb-6 border bg-card px-4 py-3 text-sm text-destructive">{String(error)}</p>;
  if (ok) return <p className="mb-6 border bg-card px-4 py-3 text-sm">{String(ok)}</p>;
  return null;
}

export default async function Competencia({ searchParams }: PageProps<"/alumnos/competencia">) {
  const persona = await requireRol("alumno", "mentor");
  const supabase = await createClient();

  // Grupos que puede ver cada uno: el alumno los suyos, el mentor los que le asignaron, los profesores todos.
  let proyectos: { id: string; nombre: string }[] = [];
  if (persona.rol === "alumno") {
    const { data, error } = await supabase.from("proyecto_integrantes").select("proyectos(id, nombre)").eq("persona_id", persona.id);
    if (error) throw error;
    proyectos = data.map((d) => d.proyectos);
  } else {
    const { data, error } = await supabase.from("proyectos").select("id, nombre").order("nombre");
    if (error) throw error;
    if (persona.rol === "mentor") {
      const asignado = await Promise.all(
        data.map(async (p) => {
          const r = await supabase.rpc("alumnos_soy_mentor", { p_proyecto: p.id });
          if (r.error) throw r.error;
          return r.data;
        }),
      );
      proyectos = data.filter((_, i) => asignado[i]);
    } else {
      proyectos = data;
    }
  }

  const titulo = <h1 className="mb-2 font-serif text-2xl">Competencia</h1>;
  if (proyectos.length === 0) {
    return (
      <div className="max-w-xl border bg-card p-8">
        {titulo}
        <p className="text-sm text-[#666]">
          {persona.rol === "mentor"
            ? "Todavía no te asignaron ningún grupo. Cuando el coordinador te asigne uno, vas a ver acá su análisis de competencia."
            : "Todavía no estás en un grupo. Cuando los profesores te sumen a un proyecto, vas a poder analizar su competencia acá."}
        </p>
      </div>
    );
  }

  const { proyecto: elegido } = await searchParams;
  const proyecto = proyectos.find((p) => p.id === elegido) ?? proyectos[0];
  const esAlumno = persona.rol === "alumno";

  const [breve, analisis, hoy, limite] = await Promise.all([
    supabase.from("alumnos_competencia_breve").select("problema, solucion, publico, mercado, updated_at").eq("proyecto_id", proyecto.id).maybeSingle(),
    supabase
      .from("alumnos_competencia_analisis")
      .select("id, estado, resultado, created_at, pedido:personas!alumnos_competencia_analisis_pedido_por_fkey(nombre)")
      .eq("proyecto_id", proyecto.id)
      .order("created_at", { ascending: false }),
    supabase.rpc("alumnos_analisis_hoy", { p_proyecto: proyecto.id }),
    supabase.rpc("alumnos_analisis_limite"),
  ]);
  for (const r of [breve, analisis, hoy, limite]) if (r.error) throw r.error;

  const porDia = limite.data ?? 0;
  const restantes = Math.max(0, porDia - (hoy.data ?? 0));
  // Solo se muestran los análisis terminados; uno pendiente de hace menos de 3 minutos está en curso.
  const [ultimo, ...anteriores] = analisis.data!.filter((a) => a.estado === "listo");
  const haceTres = new Date().getTime() - 3 * 60 * 1000;
  const enCurso = analisis.data!.some((a) => a.estado === "pendiente" && new Date(a.created_at).getTime() > haceTres);
  const breveCambio = !!(ultimo && breve.data && breve.data.updated_at > ultimo.created_at);
  const ia = hayIA();

  return (
    <>
      {titulo}
      <p className="mb-6 max-w-2xl text-sm text-[#666]">
        Completen el breve de su proyecto y la IA busca en internet competidores y alternativas, con la fuente de cada uno,
        posibles diferenciales y preguntas que desafían la propuesta. Es un punto de partida para investigar, no una nota:
        nunca va a decir que una idea es original, porque una búsqueda no alcanza para saberlo.
      </p>

      {proyectos.length > 1 && (
        <nav className="mb-6 flex flex-wrap gap-2" aria-label="Grupo">
          {proyectos.map((p) => (
            <Link
              key={p.id}
              href={`/alumnos/competencia?proyecto=${p.id}`}
              className={cn("border px-3 py-1 text-sm", p.id === proyecto.id ? "border-primary bg-primary text-primary-foreground" : "hover:bg-card")}
            >
              {p.nombre}
            </Link>
          ))}
        </nav>
      )}

      <Suspense><Aviso searchParams={searchParams} /></Suspense>

      <h2 className="mb-4 font-serif text-xl">{proyecto.nombre}</h2>

      <div className="grid max-w-3xl gap-6">
        <section className="grid gap-4 border bg-card p-6">
          <div>
            <h3 className="font-serif text-lg">Breve del proyecto</h3>
            <p className="text-xs text-[#666]">
              {breve.data
                ? `Actualizado el ${fechaHora(breve.data.updated_at)}.`
                : esAlumno
                  ? "Lo puede completar y actualizar cualquier integrante del grupo."
                  : "El grupo todavía no completó el breve."}
            </p>
          </div>
          {esAlumno ? (
            <form action={guardarBreve} className="grid gap-4">
              <input type="hidden" name="proyecto_id" value={proyecto.id} />
              <div className="grid gap-1.5">
                <Label htmlFor="problema">¿Qué problema resuelven?</Label>
                <textarea id="problema" name="problema" required minLength={10} maxLength={1500} rows={3} defaultValue={breve.data?.problema ?? ""} className={campo} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="solucion">¿Cuál es su solución?</Label>
                <textarea id="solucion" name="solucion" required minLength={10} maxLength={1500} rows={3} defaultValue={breve.data?.solucion ?? ""} className={campo} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="publico">¿A quién apunta?</Label>
                  <input id="publico" name="publico" required minLength={3} maxLength={500} defaultValue={breve.data?.publico ?? ""} placeholder="Por ejemplo: pymes agropecuarias" className={cn(campo, "h-9 py-0")} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="mercado">Mercado</Label>
                  <input id="mercado" name="mercado" required minLength={2} maxLength={200} defaultValue={breve.data?.mercado ?? "Argentina"} className={cn(campo, "h-9 py-0")} />
                </div>
              </div>
              <div><BotonEnviar size="sm" variant="outline" enviando="Guardando…">Guardar breve</BotonEnviar></div>
            </form>
          ) : (
            breve.data && (
              <dl className="grid gap-3 text-sm">
                <div><dt className="text-[#666]">Problema</dt><dd className="whitespace-pre-line">{breve.data.problema}</dd></div>
                <div><dt className="text-[#666]">Solución</dt><dd className="whitespace-pre-line">{breve.data.solucion}</dd></div>
                <div><dt className="text-[#666]">A quién apunta</dt><dd>{breve.data.publico}</dd></div>
                <div><dt className="text-[#666]">Mercado</dt><dd>{breve.data.mercado}</dd></div>
              </dl>
            )
          )}
        </section>

        <section className="grid gap-4 border bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-serif text-lg">Análisis de competencia</h3>
              {ultimo && (
                <p className="text-xs text-[#666]">
                  Del {fechaHora(ultimo.created_at)}, pedido por {ultimo.pedido?.nombre ?? "alguien del grupo"}.
                  {breveCambio && " El breve cambió después: pidan uno nuevo para tenerlo en cuenta."}
                </p>
              )}
            </div>
            {esAlumno && (
              <form action={analizar} className="grid justify-items-end gap-1">
                <input type="hidden" name="proyecto_id" value={proyecto.id} />
                <BotonEnviar size="sm" disabled={!breve.data || restantes === 0 || !ia} enviando="Buscando en internet… (tarda un minuto)">
                  {ultimo ? "Analizar de nuevo" : "Analizar competencia"}
                </BotonEnviar>
                <span className="text-xs text-[#666]">
                  {!ia
                    ? "Falta configurar la IA: avisales a los profesores."
                    : !breve.data
                      ? "Primero guarden el breve."
                      : restantes === 0
                        ? `Ya hicieron los ${porDia} de hoy. Mañana pueden pedir otro.`
                        : `Les quedan ${restantes} de ${porDia} por hoy.`}
                </span>
              </form>
            )}
          </div>

          {enCurso && <p className="text-sm text-[#666]">Hay un análisis en curso: en un minuto recargá la página para verlo.</p>}
          {ultimo ? (
            <Analisis resultado={ultimo.resultado as Partial<Resultado>} />
          ) : (
            <p className="text-sm text-[#666]">Todavía no hay ningún análisis para este proyecto.</p>
          )}
        </section>

        {anteriores.length > 0 && (
          <section className="grid gap-2">
            <h3 className="font-serif text-lg">Análisis anteriores</h3>
            {anteriores.map((a) => (
              <details key={a.id} className="border bg-card">
                <summary className="cursor-pointer px-6 py-3 text-sm">
                  {fechaHora(a.created_at)} · {a.pedido?.nombre ?? "alguien del grupo"}
                </summary>
                <div className="border-t px-6 py-5"><Analisis resultado={a.resultado as Partial<Resultado>} /></div>
              </details>
            ))}
          </section>
        )}
      </div>
    </>
  );
}
