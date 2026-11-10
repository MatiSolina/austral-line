import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FormularioExperiencia } from "./formulario";

export default async function MiAcompanamiento() {
  const alumno = await requireRol("alumno");
  const supabase = await createClient();
  const [integrantesResult, experienciaResult] = await Promise.all([
    supabase.from("proyecto_integrantes").select("proyecto_id").eq("persona_id", alumno.id),
    supabase.from("austral_satisfaccion_mentoria").select("proyecto_id, puntaje, comentario")
      .eq("alumno_id", alumno.id),
  ]);
  if (integrantesResult.error) throw integrantesResult.error;
  if (experienciaResult.error) throw experienciaResult.error;
  const ids = (integrantesResult.data ?? []).map((i) => i.proyecto_id);
  const { data: proyectos, error } = ids.length
    ? await supabase.from("proyectos").select("id, nombre").in("id", ids).order("nombre")
    : { data: [], error: null };
  if (error) throw error;
  const anteriores = new Map((experienciaResult.data ?? []).map((e) => [e.proyecto_id, e]));
  return <div className="space-y-8">
    <header className="space-y-2">
      <p className="text-xs font-medium uppercase text-[#666]">Austral / Alumnos</p>
      <h1 className="font-serif text-2xl">Mi acompañamiento</h1>
      <p className="max-w-2xl text-sm text-[#666]">Contanos cómo está funcionando la mentoría y si tu equipo necesita una consulta específica. Tu respuesta ayuda a Austral a revisar las recomendaciones.</p>
    </header>
    {!proyectos?.length && <p className="border-y py-8 text-sm text-[#666]">Todavía no figurás como integrante de un proyecto.</p>}
    {proyectos?.map((proyecto) => <section key={proyecto.id} className="space-y-3">
      <h2 className="font-serif text-xl">{proyecto.nombre}</h2>
      <FormularioExperiencia proyectoId={proyecto.id} anterior={anteriores.get(proyecto.id)} />
    </section>)}
  </div>;
}
