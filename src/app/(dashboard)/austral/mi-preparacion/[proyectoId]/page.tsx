// GRUPO AUSTRAL — material de un proyecto para el jurado: ficha ejecutiva (lectura rápida) y cápsula de audio.
// Los dos dicen lo mismo; el jurado elige el formato que prefiera.
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Escuchar } from "../../_components/escuchar";

export default async function Material({ params }: PageProps<"/austral/mi-preparacion/[proyectoId]">) {
  await requireRol("jurado");
  const { proyectoId } = await params;
  const supabase = await createClient();
  // La base solo devuelve el material si está aprobado y el proyecto está en un salón de este jurado.
  const { data: m, error } = await supabase
    .from("austral_materiales")
    .select("id, sector, contexto, problematica, guion, proyectos(nombre, proyecto_integrantes(personas(nombre)))")
    .eq("proyecto_id", proyectoId)
    .eq("estado", "aprobado")
    .maybeSingle();
  if (error) throw error;
  if (!m) notFound();
  const equipo = m.proyectos.proyecto_integrantes.map((i) => i.personas.nombre).join(", ");

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/austral/mi-preparacion" className="text-sm text-[#666] hover:text-primary">← Preparación</Link>

      <article className="mt-6 border p-8">
        <h1 className="font-serif text-3xl">{m.proyectos.nombre}</h1>
        <dl className="mt-3 space-y-1 text-sm text-[#666]">
          {equipo && <div><dt className="inline">Equipo: </dt><dd className="inline">{equipo}</dd></div>}
          {m.sector && <div><dt className="inline">Sector: </dt><dd className="inline">{m.sector}</dd></div>}
        </dl>

        <h2 className="mt-8 mb-2 font-serif text-xl">Contexto</h2>
        <p className="whitespace-pre-line leading-relaxed">{m.contexto}</p>

        <h2 className="mt-8 mb-2 font-serif text-xl">Problemática central</h2>
        <p className="whitespace-pre-line leading-relaxed">{m.problematica}</p>
      </article>

      <section className="mt-6 border p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-serif text-xl">Cápsula de audio</h2>
            <p className="text-sm text-[#666]">La misma información, para escuchar en 1 o 2 minutos.</p>
          </div>
          <Escuchar texto={m.guion!} materialId={m.id} />
        </div>
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-[#666]">Ver el guion</summary>
          <p className="mt-3 whitespace-pre-line leading-relaxed">{m.guion}</p>
        </details>
      </section>

      <p className="mt-6 text-xs text-[#666]">
        Material preparado a partir de los documentos del equipo y revisado por la organización. Cuenta solo el problema: la solución la presentan los alumnos en la jornada.
      </p>
    </div>
  );
}
