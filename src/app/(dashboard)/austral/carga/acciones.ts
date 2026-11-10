"use server";
// GRUPO AUSTRAL — vista previa e importación de la carga masiva de la materia. Solo el admin.
// No crea usuarios para entrar a la app: eso se hace solo desde Miembros (core, con el cliente admin).
import { revalidatePath } from "next/cache";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { tipos, validar, type Contexto, type Fila, type Tipo } from "./_carga";

type Supabase = Awaited<ReturnType<typeof createClient>>;
const MAX = 500_000;

async function contexto(supabase: Supabase): Promise<Contexto> {
  const [personas, carreras, proyectos] = await Promise.all([
    supabase.from("personas_contacto").select("id, nombre, email, rol"),
    supabase.from("alumnos_carreras_maestro").select("id, nombre").eq("activo", true).order("orden"),
    supabase.from("proyectos").select("id, nombre"),
  ]);
  for (const r of [personas, carreras, proyectos]) if (r.error) throw r.error;
  return {
    // El admin ve todos los mails; igual se descartan los nulos.
    personas: personas.data!.flatMap((p) => (p.id && p.nombre && p.email && p.rol ? [{ id: p.id, nombre: p.nombre, email: p.email, rol: p.rol }] : [])),
    carreras: carreras.data!,
    proyectos: proyectos.data!,
  };
}

const esTipo = (t: string): t is Tipo => t in tipos;

export async function previsualizar(tipo: string, texto: string): Promise<{ filas: Fila[]; errorGeneral: string | null }> {
  await requireRol();
  if (!esTipo(tipo)) return { filas: [], errorGeneral: "Tipo de carga desconocido." };
  if (texto.length > MAX) return { filas: [], errorGeneral: "El archivo es demasiado grande (máximo 500 KB)." };
  return validar(tipo, texto, await contexto(await createClient()));
}

export async function importar(tipo: string, texto: string): Promise<{ ok: boolean; mensaje: string }> {
  const admin = await requireRol();
  if (!esTipo(tipo) || texto.length > MAX) return { ok: false, mensaje: "Archivo o tipo inválido." };
  const supabase = await createClient();
  const { filas, errorGeneral } = validar(tipo, texto, await contexto(supabase));
  if (errorGeneral) return { ok: false, mensaje: errorGeneral };
  const validas = filas.filter((f) => !f.errores.length);
  const salteadas = filas.length - validas.length;
  if (!validas.length) return { ok: false, mensaje: "No hay filas válidas para importar." };
  const fallidas: number[] = [];

  if (tipo === "proyectos") {
    for (const f of validas) {
      let proyectoId = f.personaId;
      if (!proyectoId) {
        // Los proyectos de la materia entran publicados: así se pueden asignar a salones y evaluar.
        const alta = await supabase.from("proyectos").insert({ nombre: f.datos.nombre, estado: "publicado" }).select("id").single();
        if (alta.error) { fallidas.push(f.linea); continue; }
        proyectoId = alta.data.id;
      }
      const integrantes = f.participantes.map((p) => ({ proyecto_id: proyectoId!, persona_id: p.id }));
      const suma = await supabase.from("proyecto_integrantes").upsert(integrantes, { onConflict: "proyecto_id,persona_id", ignoreDuplicates: true });
      if (suma.error) fallidas.push(f.linea);
    }
  } else {
    const rol = tipos[tipo].rol!;
    // 1. Personas nuevas (sin usuario para entrar) y nombres actualizados de las que ya estaban.
    const nuevas = validas.filter((f) => !f.personaId);
    if (nuevas.length) {
      const alta = await supabase.from("personas").insert(nuevas.map((f) => ({ nombre: f.datos.nombre, email: f.datos.email.toLowerCase(), rol })));
      if (alta.error) return { ok: false, mensaje: `No se pudieron crear las personas nuevas (${alta.error.message}).` };
    }
    const cambios = await Promise.all(
      validas.filter((f) => f.personaId).map((f) => supabase.from("personas").update({ nombre: f.datos.nombre }).eq("id", f.personaId!)),
    );
    validas.filter((f) => f.personaId).forEach((f, k) => { if (cambios[k].error) fallidas.push(f.linea); });

    // 2. Ids de todos (las nuevas recién creadas incluidas), por email.
    const { personas } = await contexto(supabase);
    const idDe = new Map(personas.map((p) => [p.email.toLowerCase(), p.id]));
    const conId = validas.filter((f) => idDe.has(f.datos.email.toLowerCase()) && !fallidas.includes(f.linea));
    validas.filter((f) => !idDe.has(f.datos.email.toLowerCase())).forEach((f) => fallidas.push(f.linea));

    // 3. Teléfono y especialidad (datos internos del admin). Una celda vacía no pisa lo que ya había.
    const ahora = new Date().toISOString();
    const contactos = await Promise.all(
      conId.map((f) =>
        supabase.from("austral_datos_contacto").upsert({
          persona_id: idDe.get(f.datos.email.toLowerCase())!,
          ...(f.datos.telefono && { telefono: f.datos.telefono }),
          ...(f.datos.especialidad && { especialidad: f.datos.especialidad }),
          cargado_por: admin.id,
          updated_at: ahora,
        }),
      ),
    );
    conId.forEach((f, k) => { if (contactos[k].error) fallidas.push(f.linea); });

    // 4. Carrera de los alumnos, en la tabla del grupo Alumnos.
    if (tipo === "alumnos") {
      const conCarrera = conId.filter((f) => f.carreraId);
      if (conCarrera.length) {
        const carreras = await supabase.from("alumnos_carreras").upsert(
          conCarrera.map((f) => ({ persona_id: idDe.get(f.datos.email.toLowerCase())!, carrera_id: f.carreraId! })),
          { onConflict: "persona_id" },
        );
        if (carreras.error) conCarrera.forEach((f) => fallidas.push(f.linea));
      }
    }
  }

  revalidatePath("/", "layout");
  const unicas = [...new Set(fallidas)].sort((a, b) => a - b);
  const importadas = validas.length - unicas.length;
  const partes = [
    `${tipos[tipo].titulo}: se importaron ${importadas} fila${importadas === 1 ? "" : "s"}`,
    salteadas ? `${salteadas} con errores no se cargaron` : "",
    unicas.length ? `no se pudieron guardar las filas ${unicas.join(", ")} (probá de nuevo)` : "",
  ].filter(Boolean);
  return { ok: importadas > 0 && !unicas.length, mensaje: `${partes.join("; ")}.` };
}
