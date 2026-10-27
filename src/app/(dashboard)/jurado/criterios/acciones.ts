"use server";
// GRUPO JURADO — acciones de la pantalla de criterios. Todas son solo para el admin/organizador.
// `ambito` es "base" (la lista de partida) o el id de un evento. Las reglas importantes (criterios fijos desde la primera
// evaluación, criterios usados que no se borran) están también en la base.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const FIJOS = "Este evento ya recibió evaluaciones: sus criterios quedaron fijos.";

function volver(ambito: string, tipo: "ok" | "error", mensaje: string): never {
  revalidatePath("/jurado", "layout");
  redirect(`/jurado/criterios?evento=${ambito}&${tipo}=${encodeURIComponent(mensaje)}`);
}

async function preparar(formData: FormData) {
  await requireRol(); // solo admin
  return { ambito: String(formData.get("ambito") ?? "base"), supabase: await createClient() };
}

const limpiar = (formData: FormData, campo: string) => String(formData.get(campo) ?? "").trim().replace(/\s+/g, " ");

// Mismos límites que la pantalla y la base: nombre hasta 60 letras, descripción hasta 200.
const NOMBRE_MAX = 60;
const DESCRIPCION_MAX = 200;
function revisarLargo(ambito: string, nombre: string, descripcion: string | null) {
  if (nombre.length > NOMBRE_MAX) volver(ambito, "error", `El nombre puede tener hasta ${NOMBRE_MAX} letras.`);
  if (descripcion && descripcion.length > DESCRIPCION_MAX) volver(ambito, "error", `La descripción puede tener hasta ${DESCRIPCION_MAX} letras.`);
}

type Cliente = Awaited<ReturnType<typeof createClient>>;

// Los criterios de un ámbito, en orden: { id, nombre, orden }.
async function listar(supabase: Cliente, ambito: string) {
  if (ambito === "base") {
    const { data, error } = await supabase.from("jurado_criterios").select("id, nombre, orden").eq("es_base", true).order("orden").order("nombre");
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase
    .from("jurado_evento_criterios").select("orden, jurado_criterios(id, nombre)").eq("evento_id", ambito).order("orden");
  if (error) throw error;
  return data.map((r) => ({ id: r.jurado_criterios.id, nombre: r.jurado_criterios.nombre, orden: r.orden }));
}

export async function crearCriterio(formData: FormData) {
  const { ambito, supabase } = await preparar(formData);
  const nombre = limpiar(formData, "nombre");
  const descripcion = limpiar(formData, "descripcion") || null;
  if (!nombre) volver(ambito, "error", "Poné un nombre para el criterio.");
  revisarLargo(ambito, nombre, descripcion);

  const existentes = await listar(supabase, ambito);
  if (existentes.some((c) => c.nombre.toLowerCase() === nombre.toLowerCase())) volver(ambito, "error", `Ya hay un criterio "${nombre}" en esta lista.`);
  const orden = Math.max(0, ...existentes.map((c) => c.orden)) + 1;

  const { data: creado, error } = await supabase
    .from("jurado_criterios").insert({ nombre, descripcion, orden, es_base: ambito === "base" }).select("id").single();
  if (error) throw error;
  if (ambito !== "base") {
    const { error: errorLink } = await supabase.from("jurado_evento_criterios").insert({ evento_id: ambito, criterio_id: creado.id, orden });
    if (errorLink) {
      await supabase.from("jurado_criterios").delete().eq("id", creado.id); // no dejar un criterio suelto
      if (errorLink.code === "42501") volver(ambito, "error", FIJOS);
      throw errorLink;
    }
  }
  volver(ambito, "ok", `Criterio "${nombre}" agregado.`);
}

export async function guardarCriterio(formData: FormData) {
  const { ambito, supabase } = await preparar(formData);
  const id = String(formData.get("criterio_id"));
  const nombre = limpiar(formData, "nombre");
  const descripcion = limpiar(formData, "descripcion") || null;
  if (!nombre) volver(ambito, "error", "El criterio necesita un nombre.");
  revisarLargo(ambito, nombre, descripcion);

  const lista = await listar(supabase, ambito);
  if (lista.some((c) => c.id !== id && c.nombre.toLowerCase() === nombre.toLowerCase())) volver(ambito, "error", `Ya hay un criterio "${nombre}" en esta lista.`);

  // Si el criterio ya tiene notas o su evento ya recibió evaluaciones, la base no deja cambiarlo (0 filas).
  const { data, error } = await supabase.from("jurado_criterios").update({ nombre, descripcion }).eq("id", id).select("id");
  if (error) throw error;
  if (data.length === 0) volver(ambito, "error", "Este criterio ya no se puede cambiar: tiene notas o su evento ya recibió evaluaciones.");
  volver(ambito, "ok", `Criterio "${nombre}" guardado.`);
}

// Sube o baja un criterio: se renumera todo para que el orden quede siempre 1, 2, 3…
export async function moverCriterio(formData: FormData) {
  const { ambito, supabase } = await preparar(formData);
  const id = String(formData.get("criterio_id"));
  const salto = formData.get("direccion") === "subir" ? -1 : 1;

  const criterios = await listar(supabase, ambito);
  const desde = criterios.findIndex((c) => c.id === id);
  const hasta = desde + salto;
  if (desde === -1 || hasta < 0 || hasta >= criterios.length) volver(ambito, "ok", "Ya está en ese extremo.");
  [criterios[desde], criterios[hasta]] = [criterios[hasta], criterios[desde]];

  for (const [i, c] of criterios.entries()) {
    if (c.orden === i + 1) continue;
    const { data, error } = ambito === "base"
      ? await supabase.from("jurado_criterios").update({ orden: i + 1 }).eq("id", c.id).select("id")
      : await supabase.from("jurado_evento_criterios").update({ orden: i + 1 }).eq("evento_id", ambito).eq("criterio_id", c.id).select("criterio_id");
    if (error) throw error;
    if (data.length === 0) volver(ambito, "error", ambito === "base" ? "No se pudo reordenar." : FIJOS);
  }
  volver(ambito, "ok", "Orden actualizado.");
}

// Quitar un criterio de la lista. En un evento solo se puede mientras no recibió evaluaciones.
export async function quitarCriterio(formData: FormData) {
  const { ambito, supabase } = await preparar(formData);
  const id = String(formData.get("criterio_id"));

  if (ambito !== "base") {
    const { data, error } = await supabase.from("jurado_evento_criterios").delete().eq("evento_id", ambito).eq("criterio_id", id).select("criterio_id");
    if (error) throw error;
    if (data.length === 0) volver(ambito, "error", FIJOS);
  }
  // Si el criterio quedó suelto y nunca se usó, se borra; si no, la base lo conserva.
  const { error: errorBaja } = await supabase.from("jurado_criterios").delete().eq("id", id);
  if (errorBaja && ambito === "base") throw errorBaja;
  volver(ambito, "ok", "Criterio quitado de la lista.");
}

// Empezar el evento con la lista base, o copiar los criterios de otro evento. Reemplaza lo que tenga (solo si no recibió evaluaciones).
export async function aplicarLista(formData: FormData) {
  const { ambito, supabase } = await preparar(formData);
  const origen = String(formData.get("origen") ?? "base");
  const { data, error } = await supabase.rpc("jurado_criterios_aplicar", { p_evento: ambito, ...(origen === "base" ? {} : { p_origen: origen }) });
  if (error?.code === "P0001") volver(ambito, "error", `${error.message}.`);
  if (error) throw error;
  volver(ambito, "ok", `Quedaron ${data} ${data === 1 ? "criterio" : "criterios"} en este evento.`);
}
