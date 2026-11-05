// GRUPO AUSTRAL — necesidades de un proyecto: tamaño del equipo, habilidades que busca, disponibilidad y estado de la búsqueda.
import { notFound } from "next/navigation";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { BotonEnviar } from "../../../_components/boton-enviar";
import { campoClase, Encabezado, selectClase } from "../../_components/encabezado";
import { cargarMatching, estadosBusqueda } from "../../_datos";
import { categorias, cubiertas, franjas, modalidades, niveles, type Categoria } from "../../_motor";
import { guardarNecesidades } from "../../acciones";

export default async function EditarProyecto({ params, searchParams }: PageProps<"/austral/matching/proyectos/[proyectoId]">) {
  await requireRol(); // solo admin
  const { proyectoId } = await params;
  const { ok, error } = await searchParams;
  const datos = await cargarMatching(await createClient());
  const p = datos.todosLosProyectos.find((x) => x.id === proyectoId);
  if (!p) notFound();
  const n = p.necesidad;
  const ya = cubiertas(p.proyecto);
  const buscadas = new Set(p.proyecto.buscadas.map((h) => h.id));
  const porCategoria = Object.keys(categorias).map((c) => ({ c: c as Categoria, lista: datos.habilidades.filter((h) => h.categoria === c) }));
  const volver = `/austral/matching/proyectos/${proyectoId}`;

  return (
    <div className="mx-auto max-w-4xl">
      <Encabezado titulo={p.nombre} descripcion={p.descripcion ?? undefined} actual="/austral/matching/proyectos" ok={ok} error={error} />

      <section className="mt-6 border p-5 text-sm">
        <h2 className="mb-2 font-medium">Integrantes actuales ({p.proyecto.integrantes.length})</h2>
        {p.proyecto.integrantes.length === 0 ? (
          <p className="text-[#666]">Todavía no tiene integrantes.</p>
        ) : (
          <ul className="space-y-1">
            {p.proyecto.integrantes.map((i, k) => (
              <li key={k}>
                {i.nombre} <span className="text-[#666]">· {i.carrera ?? "sin carrera"} · {i.habilidades.map((h) => `${h.nombre} (${niveles[h.nivel].toLowerCase()})`).join(", ") || "sin habilidades cargadas"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action={guardarNecesidades} className="mt-8 space-y-6">
        <input type="hidden" name="proyecto_id" value={proyectoId} />
        <input type="hidden" name="volver" value={volver} />

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="integrantes_necesarios">Integrantes que necesita (en total)</Label>
            <input id="integrantes_necesarios" name="integrantes_necesarios" type="number" min={1} max={12} defaultValue={n?.integrantes_necesarios ?? Math.max(4, p.proyecto.integrantes.length + 1)} className={campoClase} />
          </div>
          <div>
            <Label htmlFor="estado">Estado de la búsqueda</Label>
            <select id="estado" name="estado" defaultValue={n?.estado ?? "buscando"} className={`${selectClase} mt-1 w-full`}>
              {Object.entries(estadosBusqueda).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="modalidad">Modalidad de trabajo</Label>
            <select id="modalidad" name="modalidad" defaultValue={n?.modalidad ?? ""} className={`${selectClase} mt-1 w-full`}>
              <option value="">Sin dato</option>
              {Object.entries(modalidades).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        <div>
          <Label htmlFor="objetivo">Descripción y objetivo</Label>
          <textarea id="objetivo" name="objetivo" rows={2} defaultValue={n?.objetivo ?? ""} className={campoClase} />
        </div>
        <div>
          <Label htmlFor="problematica">Problemática que busca resolver</Label>
          <textarea id="problematica" name="problematica" rows={2} defaultValue={n?.problematica ?? ""} className={campoClase} />
        </div>

        <fieldset>
          <legend className="text-sm font-medium">Perfiles y habilidades que busca</legend>
          <p className="text-xs text-[#666]">Las marcadas como &quot;ya cubierta&quot; las tiene algún integrante en nivel intermedio o avanzado.</p>
          <div className="mt-3 grid gap-6 sm:grid-cols-2">
            {porCategoria.map(({ c, lista }) => (
              <div key={c}>
                <h3 className="mb-2 text-sm text-[#666]">{categorias[c]}</h3>
                {lista.map((h) => (
                  <label key={h.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="buscada" value={h.id} defaultChecked={buscadas.has(h.id)} /> {h.nombre}
                    {ya.has(h.id) && <Badge variant="secondary">ya cubierta</Badge>}
                  </label>
                ))}
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium">Disponibilidad del equipo</legend>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            {Object.entries(franjas).map(([k, v]) => (
              <label key={k} className="flex items-center gap-2">
                <input type="checkbox" name="disponibilidad" value={k} defaultChecked={n?.disponibilidad.includes(k)} /> {v}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="border-t pt-5">
          <BotonEnviar enviando="Guardando…">Guardar necesidades</BotonEnviar>
        </div>
      </form>
    </div>
  );
}
