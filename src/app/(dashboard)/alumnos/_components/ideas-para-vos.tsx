// GRUPO ALUMNOS — "Ideas para vos": las ideas disponibles del banco cuyos temas el alumno calificó con 4 o 5
// estrellas. Conecta el perfil con el banco: un alumno sin idea propia encuentra rápido una que le interese.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { UMBRAL } from "../_lib/afinidad";

const CANTIDAD = 3;

export async function IdeasParaVos({ personaId, estrellas }: { personaId: string; estrellas: Map<number, number> }) {
  const supabase = await createClient();
  const [ideas, interesados] = await Promise.all([
    supabase
      .from("alumnos_ideas")
      .select("id, titulo, descripcion, autor_id, interes_id, alumnos_intereses_maestro(nombre)")
      .eq("estado", "disponible"),
    supabase.from("alumnos_ideas_interesados").select("idea_id, persona_id"),
  ]);
  if (ideas.error) throw ideas.error;
  if (interesados.error) throw interesados.error;

  const cuantos = (ideaId: string) => interesados.data.filter((i) => i.idea_id === ideaId).length;
  const meInteresa = (ideaId: string) => interesados.data.some((i) => i.idea_id === ideaId && i.persona_id === personaId);

  // Solo temas que te interesan mucho; ni tus propias ideas ni las que ya marcaste.
  const sugeridas = ideas.data
    .map((i) => ({ ...i, mias: i.interes_id ? (estrellas.get(i.interes_id) ?? 0) : 0, interesados: cuantos(i.id) }))
    .filter((i) => i.mias >= UMBRAL.mucho && i.autor_id !== personaId && !meInteresa(i.id))
    .sort((a, b) => b.mias - a.mias || b.interesados - a.interesados)
    .slice(0, CANTIDAD);

  return (
    <section className="mt-12 grid gap-4">
      <div>
        <h2 className="font-serif text-xl">Ideas del banco para vos</h2>
        <p className="text-sm text-[#666]">
          Problemáticas disponibles de los temas que calificaste con {UMBRAL.mucho} o 5 estrellas.
        </p>
      </div>
      {sugeridas.length === 0 ? (
        <p className="border bg-card p-6 text-sm text-[#666]">
          Por ahora no hay ideas nuevas de tus temas favoritos.{" "}
          <Link href="/alumnos/ideas" className="underline underline-offset-4 hover:text-primary">Mirá todo el banco</Link> o proponé una.
        </p>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-3">
          {sugeridas.map((i) => (
            <li key={i.id} className="flex flex-col gap-3 border bg-background p-5">
              <div className="flex flex-wrap gap-2">
                {i.alumnos_intereses_maestro && <Badge variant="outline">{i.alumnos_intereses_maestro.nombre}</Badge>}
                <Badge variant="secondary">Le pusiste {i.mias} estrellas</Badge>
              </div>
              <Link href={`/alumnos/ideas/${i.id}`} className="font-serif text-lg hover:underline hover:underline-offset-4">
                {i.titulo}
              </Link>
              <p className="line-clamp-3 text-sm text-[#666]">{i.descripcion}</p>
              <p className="mt-auto text-xs text-[#666]">
                {i.interesados === 0 ? "Todavía nadie se sumó" : `${i.interesados} ${i.interesados === 1 ? "interesado" : "interesados"}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
