// GRUPO AUSTRAL — edición del perfil de matching de un alumno: habilidades con nivel, año, disponibilidad y preferencias.
import { notFound } from "next/navigation";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Label } from "@/components/ui/label";
import { BotonEnviar } from "../../../_components/boton-enviar";
import { campoClase, Encabezado, selectClase } from "../../_components/encabezado";
import { categorias, franjas, modalidades, niveles, type Categoria } from "../../_motor";
import { guardarPerfil } from "../../acciones";

export default async function EditarAlumno({ params, searchParams }: PageProps<"/austral/matching/alumnos/[personaId]">) {
  await requireRol(); // solo admin
  const { personaId } = await params;
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  const [persona, perfil, propias, habilidades, carrera, intereses, sobreMi] = await Promise.all([
    supabase.from("personas").select("nombre, rol").eq("id", personaId).maybeSingle(),
    supabase.from("austral_perfiles_matching").select("*").eq("persona_id", personaId).maybeSingle(),
    supabase.from("austral_perfil_habilidades").select("habilidad_id, nivel").eq("persona_id", personaId),
    supabase.from("austral_habilidades").select("id, nombre, categoria").order("orden"),
    supabase.from("alumnos_carreras").select("alumnos_carreras_maestro(nombre)").eq("persona_id", personaId).maybeSingle(),
    supabase.from("alumnos_intereses").select("estrellas, alumnos_intereses_maestro(nombre)").eq("persona_id", personaId).order("estrellas", { ascending: false }),
    supabase.from("alumnos_perfiles").select("sobre_mi").eq("persona_id", personaId).maybeSingle(),
  ]);
  for (const r of [persona, perfil, propias, habilidades, carrera, intereses, sobreMi]) if (r.error) throw r.error;
  if (!persona.data || persona.data.rol !== "alumno") notFound();
  const p = perfil.data;
  const nivelDe = new Map(propias.data!.map((h) => [h.habilidad_id, h.nivel]));
  const porCategoria = Object.keys(categorias).map((c) => ({ c: c as Categoria, lista: habilidades.data!.filter((h) => h.categoria === c) }));
  const volver = `/austral/matching/alumnos/${personaId}`;

  return (
    <div className="mx-auto max-w-4xl">
      <Encabezado titulo={persona.data.nombre} descripcion="Perfil para el matching." actual="/austral/matching/alumnos" ok={ok} error={error} />

      <section className="mt-6 border p-5 text-sm">
        <h2 className="mb-2 font-medium">Lo que cargó el alumno en su perfil</h2>
        <p><span className="text-[#666]">Carrera:</span> {carrera.data?.alumnos_carreras_maestro.nombre ?? "sin elegir"}</p>
        <p className="mt-1"><span className="text-[#666]">Intereses:</span> {intereses.data!.length ? intereses.data!.map((i) => `${i.alumnos_intereses_maestro.nombre} (${i.estrellas}★)`).join(", ") : "sin cargar"}</p>
        {sobreMi.data?.sobre_mi && <p className="mt-1"><span className="text-[#666]">Sobre mí:</span> {sobreMi.data.sobre_mi}</p>}
        <p className="mt-2 text-xs text-[#666]">Esto lo edita cada alumno desde Alumnos → Mi perfil.</p>
      </section>

      <form action={guardarPerfil} className="mt-8 space-y-6">
        <input type="hidden" name="persona_id" value={personaId} />
        <input type="hidden" name="volver" value={volver} />

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="anio">Año de cursado</Label>
            <select id="anio" name="anio" defaultValue={p?.anio ?? ""} className={`${selectClase} mt-1 w-full`}>
              <option value="">Sin dato</option>
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}º año</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="area">Área de conocimiento o especialización</Label>
            <input id="area" name="area" defaultValue={p?.area ?? ""} className={campoClase} />
          </div>
        </div>

        <fieldset>
          <legend className="text-sm font-medium">Habilidades</legend>
          <div className="mt-3 grid gap-6 sm:grid-cols-2">
            {porCategoria.map(({ c, lista }) => (
              <div key={c}>
                <h3 className="mb-2 text-sm text-[#666]">{categorias[c]}</h3>
                <div className="space-y-1">
                  {lista.map((h) => (
                    <label key={h.id} className="flex items-center justify-between gap-3 text-sm">
                      <span>{h.nombre}</span>
                      <select name={`habilidad:${h.id}`} aria-label={`Nivel de ${h.nombre}`} defaultValue={nivelDe.get(h.id) ?? 0} className="h-8 border bg-background px-1 text-sm">
                        <option value={0}>—</option>
                        {[1, 2, 3].map((n) => <option key={n} value={n}>{niveles[n]}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset>
            <legend className="text-sm font-medium">Disponibilidad horaria</legend>
            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              {Object.entries(franjas).map(([k, v]) => (
                <label key={k} className="flex items-center gap-2">
                  <input type="checkbox" name="disponibilidad" value={k} defaultChecked={p?.disponibilidad.includes(k)} /> {v}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <Label htmlFor="modalidad">Modalidad preferida</Label>
            <select id="modalidad" name="modalidad" defaultValue={p?.modalidad ?? ""} className={`${selectClase} mt-1 w-full`}>
              <option value="">Sin dato</option>
              {Object.entries(modalidades).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        <div>
          <Label htmlFor="experiencia">Experiencia previa en proyectos</Label>
          <textarea id="experiencia" name="experiencia" rows={3} defaultValue={p?.experiencia ?? ""} className={campoClase} />
        </div>
        <div>
          <Label htmlFor="preferencias">Preferencias: en qué proyectos o temas le gustaría participar</Label>
          <textarea id="preferencias" name="preferencias" rows={2} defaultValue={p?.preferencias ?? ""} className={campoClase} />
        </div>

        <div className="border-t pt-5">
          <BotonEnviar enviando="Guardando…">Guardar perfil</BotonEnviar>
        </div>
      </form>
    </div>
  );
}
