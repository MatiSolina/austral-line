// GRUPO JURADO — estado del resumen del pitch de cada equipo de un evento (lo usan el panel, la revisión y el agente).
import { contarPalabras, palabrasPorEquipo, type Supabase, type Tipo } from "../_resumenes";

export type Archivo = { id: string; tipo: Tipo; nombre: string; ruta: string; mime: string; bytes: number; created_at: string };

export async function cargarEvento(supabase: Supabase, eventoId: string) {
  const [evento, salones, archivos, resumenes] = await Promise.all([
    supabase.from("eventos").select("id, nombre, inicio").eq("id", eventoId).maybeSingle(),
    supabase
      .from("jurado_salones")
      .select("id, nombre, jurado_salon_proyectos(proyecto_id, proyectos(nombre))")
      .eq("evento_id", eventoId)
      .order("orden"),
    supabase.from("jurado_resumen_archivos").select("id, proyecto_id, tipo, nombre, ruta, mime, bytes, created_at").eq("evento_id", eventoId),
    supabase.from("jurado_resumenes").select("*").eq("evento_id", eventoId),
  ]);
  if (evento.error?.code === "22P02") return null; // id con formato inválido
  for (const r of [evento, salones, archivos, resumenes]) if (r.error) throw r.error;
  if (!evento.data) return null;

  const equipos = salones.data!.flatMap((s) =>
    s.jurado_salon_proyectos.map((sp) => {
      const suyos = archivos.data!.filter((a) => a.proyecto_id === sp.proyecto_id) as (Archivo & { proyecto_id: string })[];
      const resumen = resumenes.data!.find((r) => r.proyecto_id === sp.proyecto_id) ?? null;
      return {
        id: sp.proyecto_id,
        nombre: sp.proyectos.nombre,
        salon: { id: s.id, nombre: s.nombre, equipos: s.jurado_salon_proyectos.length },
        presentacion: suyos.find((a) => a.tipo === "presentacion") ?? null,
        transcripcion: suyos.find((a) => a.tipo === "transcripcion") ?? null,
        archivos: suyos,
        resumen,
        palabras: contarPalabras(resumen?.texto ?? null),
        maximo: palabrasPorEquipo(s.jurado_salon_proyectos.length),
      };
    }),
  );
  return { evento: evento.data, salones: salones.data!, equipos };
}

export type Equipo = NonNullable<Awaited<ReturnType<typeof cargarEvento>>>["equipos"][number];
