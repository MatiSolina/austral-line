"use server";

// GRUPO ALUMNOS — acciones del análisis de competencia. Corren con los permisos del alumno (RLS):
// la base decide quién guarda el breve y cuántos análisis por día puede pedir el grupo.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { analizarCompetencia, hayIA, MODELO, SinFuentes } from "./_agente";

const volver = (proyectoId: string, aviso?: { error?: string; ok?: string }) => {
  revalidatePath("/alumnos/competencia");
  const q = aviso?.error ? `&error=${encodeURIComponent(aviso.error)}` : aviso?.ok ? `&ok=${encodeURIComponent(aviso.ok)}` : "";
  redirect(`/alumnos/competencia?proyecto=${encodeURIComponent(proyectoId)}${q}`);
};

const texto = (formData: FormData, campo: string) => String(formData.get(campo) ?? "").trim();

export async function guardarBreve(formData: FormData) {
  const persona = await requireRol("alumno");
  const proyectoId = texto(formData, "proyecto_id");
  const breve = {
    problema: texto(formData, "problema"),
    solucion: texto(formData, "solucion"),
    publico: texto(formData, "publico"),
    mercado: texto(formData, "mercado"),
  };
  if (breve.problema.length < 10 || breve.solucion.length < 10) {
    volver(proyectoId, { error: "Contá el problema y la solución con un poco más de detalle (al menos 10 caracteres cada uno)." });
  }
  if (breve.publico.length < 3 || breve.mercado.length < 2) volver(proyectoId, { error: "Completá a quién apunta y el mercado." });
  const supabase = await createClient();
  const { error } = await supabase
    .from("alumnos_competencia_breve")
    .upsert({ proyecto_id: proyectoId, ...breve, updated_by: persona.id, updated_at: new Date().toISOString() });
  volver(proyectoId, error ? { error: `No se pudo guardar: ${error.message}` } : { ok: "Breve guardado." });
}

// 1) Reserva el lugar en la base (cuenta para el límite del día aunque después falle), 2) llama a la IA con
// tiempo máximo, 3) guarda el resultado o marca el error. Si algo falla, el alumno ve un mensaje propio y el
// detalle técnico queda en el registro del servidor.
export async function analizar(formData: FormData) {
  await requireRol("alumno");
  const proyectoId = texto(formData, "proyecto_id");
  if (!hayIA()) volver(proyectoId, { error: "Falta configurar la IA: avisales a los profesores." });
  const supabase = await createClient();

  const { data: proyecto } = await supabase.from("proyectos").select("nombre").eq("id", proyectoId).maybeSingle();
  if (!proyecto) volver(proyectoId, { error: "No encontramos el proyecto." });
  const { data: reserva, error: errorReserva } = await supabase.rpc("alumnos_reservar_analisis", { p_proyecto: proyectoId });
  if (errorReserva || !reserva) volver(proyectoId, { error: errorReserva?.message ?? "No se pudo pedir el análisis." });
  const { data: breve } = await supabase
    .from("alumnos_competencia_analisis")
    .select("breve")
    .eq("id", reserva!)
    .single();
  const b = breve!.breve as { problema: string; solucion: string; publico: string; mercado: string };

  let resultado: Awaited<ReturnType<typeof analizarCompetencia>> | null = null;
  let aviso: string | null = null;
  try {
    resultado = await analizarCompetencia({ nombre: proyecto!.nombre, ...b });
  } catch (e) {
    console.error("[alumnos/competencia] la IA falló", e);
    aviso =
      e instanceof SinFuentes
        ? "La búsqueda en internet no devolvió resultados. Prueben contar el problema y la solución con otras palabras."
        : "La IA no pudo terminar el análisis. Ese intento cuenta para el día; prueben de nuevo en un rato o avisen a los profesores si sigue fallando.";
  }

  const { error } = await supabase.rpc("alumnos_completar_analisis", {
    p_analisis: reserva!,
    p_resultado: resultado ?? undefined,
    p_modelo: MODELO,
  });
  if (error) console.error("[alumnos/competencia] no se pudo guardar el análisis", error);
  if (aviso) volver(proyectoId, { error: aviso });
  volver(proyectoId, error ? { error: "No se pudo guardar el análisis. Avisales a los profesores." } : { ok: "Listo: el análisis nuevo está abajo." });
}
