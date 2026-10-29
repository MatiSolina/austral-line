// GRUPO AUSTRAL — "Preparación": cada jurado ve, por evento, los proyectos de su salón con la ficha y el audio que
// cuentan el problema que abordan. Solo aparecen los materiales que ya aprobó el admin (la base no deja ver el resto).
import Link from "next/link";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fechaHora, recienEmpezado } from "../_preparacion";

export default async function MiPreparacion() {
  const persona = await requireRol("jurado");
  const encabezado = (
    <>
      <h1 className="font-serif text-2xl">Preparación</h1>
      <p className="mt-1 mb-8 text-sm text-[#666]">
        Antes de cada jornada, una ficha corta y un audio de 1 a 2 minutos por proyecto, para que llegues conociendo el
        contexto y el problema que aborda cada equipo. La solución la presentan ellos en vivo.
      </p>
    </>
  );
  if (persona.rol === "admin") {
    return (
      <div className="mx-auto max-w-3xl">
        {encabezado}
        <div className="border p-10 text-center text-sm text-[#666]">
          Esta es la pantalla de los jurados: cada uno ve acá los materiales aprobados de los proyectos de su salón. Se preparan en Austral → Preparación de jurados.
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const [asignaciones, materiales] = await Promise.all([
    supabase
      .from("jurado_salon_jurados")
      .select("jurado_salones(nombre, eventos(id, nombre, inicio, lugar), jurado_salon_proyectos(proyectos(id, nombre)))")
      .eq("jurado_id", persona.id),
    supabase.from("austral_materiales").select("proyecto_id, sector"),
  ]);
  if (asignaciones.error) throw asignaciones.error;
  if (materiales.error) throw materiales.error;
  const sectorDe = new Map(materiales.data.map((m) => [m.proyecto_id, m.sector]));
  const listos = new Set(materiales.data.map((m) => m.proyecto_id));

  const desde = recienEmpezado();
  const salones = asignaciones.data
    .map((a) => a.jurado_salones)
    .sort((a, b) => a.eventos.inicio.localeCompare(b.eventos.inicio));

  return (
    <div className="mx-auto max-w-3xl">
      {encabezado}
      {salones.length === 0 && (
        <div className="border p-10 text-center text-sm text-[#666]">Todavía no tenés proyectos asignados. Cuando te asignen a un salón, los vas a ver acá.</div>
      )}
      {salones.map((s) => (
        <section key={s.eventos.id} className={`mb-10 ${s.eventos.inicio < desde ? "opacity-60" : ""}`}>
          <h2 className="font-serif text-xl">{s.eventos.nombre}</h2>
          <p className="mt-1 mb-4 text-sm text-[#666]">
            {fechaHora(s.eventos.inicio)}{s.eventos.lugar ? ` · ${s.eventos.lugar}` : ""} · {s.nombre}
            {s.eventos.inicio < desde ? " · ya pasó" : ""}
          </p>
          {s.jurado_salon_proyectos.length === 0 ? (
            <div className="border p-6 text-center text-sm text-[#666]">Tu salón todavía no tiene proyectos asignados.</div>
          ) : (
            <ul className="divide-y border">
              {s.jurado_salon_proyectos.map(({ proyectos: p }) => (
                <li key={p.id} className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <div>{p.nombre}</div>
                    {sectorDe.get(p.id) && <div className="text-sm text-[#666]">{sectorDe.get(p.id)}</div>}
                  </div>
                  {listos.has(p.id) ? (
                    <Link href={`/austral/mi-preparacion/${p.id}`} className="text-sm underline underline-offset-4">Leer y escuchar</Link>
                  ) : (
                    <span className="text-sm text-[#666]">Todavía en preparación</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
