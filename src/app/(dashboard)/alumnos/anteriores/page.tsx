// GRUPO ALUMNOS — "Años anteriores" (solo profesores): proyectos de otras cohortes. Cuando un alumno mira una
// idea del banco que se parece a alguno, se le avisa para que lo investigue y se diferencie.
import { Suspense } from "react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { agregarAnterior, quitarAnterior } from "./_acciones";

const campo = "border bg-background px-2.5 py-2 text-sm outline-none focus-visible:border-ring";

async function Aviso({ searchParams }: Pick<PageProps<"/alumnos/anteriores">, "searchParams">) {
  const { error, ok } = await searchParams;
  if (error) return <p className="mb-6 border bg-card px-4 py-3 text-sm text-destructive">{String(error)}</p>;
  if (ok) return <p className="mb-6 border bg-card px-4 py-3 text-sm">{String(ok)}</p>;
  return null;
}

export default async function Anteriores({ searchParams }: PageProps<"/alumnos/anteriores">) {
  await requireRol(); // solo profesores
  const supabase = await createClient();
  const { data: proyectos, error } = await supabase
    .from("alumnos_proyectos_anteriores")
    .select("id, nombre, anio, descripcion, resultado")
    .order("anio", { ascending: false })
    .order("nombre");
  if (error) throw error;
  const anioActual = new Date().getFullYear();

  return (
    <>
      <h1 className="mb-2 font-serif text-2xl">Proyectos de años anteriores</h1>
      <p className="mb-6 max-w-2xl text-sm text-[#666]">
        Cargá los proyectos de otras cohortes. Cuando un alumno mira una idea del banco que se parece a alguno (por las
        palabras en común), ve el aviso con el proyecto anterior para investigarlo y diferenciarse.
      </p>
      <Suspense><Aviso searchParams={searchParams} /></Suspense>

      <div className="grid max-w-3xl gap-8">
        <form action={agregarAnterior} className="grid gap-4 border bg-card p-6">
          <h2 className="font-serif text-lg">Agregar un proyecto</h2>
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <div className="grid gap-1.5">
              <Label htmlFor="nombre">Nombre</Label>
              <input id="nombre" name="nombre" required minLength={2} maxLength={120} className={`${campo} h-9 py-0`} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="anio">Año</Label>
              <input id="anio" name="anio" type="number" required min={2000} max={2100} defaultValue={anioActual - 1} className={`${campo} h-9 py-0`} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="descripcion">Qué problema resolvía y cómo</Label>
            <textarea id="descripcion" name="descripcion" required minLength={10} maxLength={3000} rows={3} className={campo} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="resultado">Qué pasó con el proyecto (opcional)</Label>
            <input id="resultado" name="resultado" maxLength={500} placeholder="Por ejemplo: ganó el Demo Day; no consiguió validar con usuarios" className={`${campo} h-9 py-0`} />
          </div>
          <div><Button type="submit" size="sm">Agregar</Button></div>
        </form>

        <section className="grid gap-3">
          <h2 className="font-serif text-lg">Cargados ({proyectos.length})</h2>
          {proyectos.length === 0 && <p className="text-sm text-[#666]">Todavía no hay proyectos de años anteriores.</p>}
          {proyectos.map((p) => (
            <article key={p.id} className="grid gap-1 border bg-card p-5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{p.nombre}</span>
                <span className="text-[#666]">· {p.anio}</span>
                <form action={quitarAnterior} className="ml-auto">
                  <input type="hidden" name="id" value={p.id} />
                  <button type="submit" className="text-xs text-[#666] hover:text-destructive">Quitar</button>
                </form>
              </div>
              <p className="text-[#666]">{p.descripcion}</p>
              {p.resultado && <p className="text-xs">Resultado: {p.resultado}</p>}
            </article>
          ))}
        </section>
      </div>
    </>
  );
}
