"use server";
// GRUPO JURADO — acciones de la pantalla de salones. Todas son solo para el admin/organizador.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function volver(eventoId: string, tipo: "ok" | "error", mensaje: string): never {
  revalidatePath("/jurado", "layout");
  redirect(`/jurado/salones?evento=${eventoId}&${tipo}=${encodeURIComponent(mensaje)}`);
}

async function preparar(formData: FormData) {
  await requireRol(); // solo admin
  return { eventoId: String(formData.get("evento_id")), supabase: await createClient() };
}

const nombreDe = (formData: FormData) => String(formData.get("nombre") ?? "").trim().replace(/\s+/g, " ");

export async function crearSalon(formData: FormData) {
  const { eventoId, supabase } = await preparar(formData);
  const nombre = nombreDe(formData);
  if (!nombre) volver(eventoId, "error", "Poné un nombre para el salón.");

  const { data: ultimo } = await supabase
    .from("jurado_salones").select("orden").eq("evento_id", eventoId).order("orden", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("jurado_salones").insert({ evento_id: eventoId, nombre, orden: (ultimo?.orden ?? 0) + 1 });
  if (error?.code === "23505") volver(eventoId, "error", `Ya hay un salón "${nombre}" en este evento.`);
  if (error) throw error;
  volver(eventoId, "ok", `Salón "${nombre}" creado.`);
}

export async function renombrarSalon(formData: FormData) {
  const { eventoId, supabase } = await preparar(formData);
  const nombre = nombreDe(formData);
  if (!nombre) volver(eventoId, "error", "El salón tiene que tener un nombre.");

  const { error } = await supabase.from("jurado_salones").update({ nombre }).eq("id", String(formData.get("salon_id"))).eq("evento_id", eventoId);
  if (error?.code === "23505") volver(eventoId, "error", `Ya hay un salón "${nombre}" en este evento.`);
  if (error) throw error;
  volver(eventoId, "ok", "Nombre actualizado.");
}

// Borrar un salón deja sus equipos y jurados sin salón (no borra a nadie ni ninguna nota).
export async function borrarSalon(formData: FormData) {
  const { eventoId, supabase } = await preparar(formData);
  const { error } = await supabase.from("jurado_salones").delete().eq("id", String(formData.get("salon_id"))).eq("evento_id", eventoId);
  if (error) throw error;
  volver(eventoId, "ok", "Salón borrado. Sus equipos y jurados quedaron sin salón.");
}

// Los selects del formulario se llaman "proyecto:<id>" y "jurado:<id>", con el id del salón como valor ("" = sin salón).
export async function guardarAsignaciones(formData: FormData) {
  const { eventoId, supabase } = await preparar(formData);
  const elegidos = (prefijo: string) =>
    [...formData.entries()]
      .filter(([clave, valor]) => clave.startsWith(prefijo) && typeof valor === "string" && valor)
      .map(([clave, valor]) => ({ id: clave.slice(prefijo.length), salon_id: String(valor) }));

  const { error } = await supabase.rpc("jurado_guardar_salones", {
    p_evento: eventoId,
    p_proyectos: elegidos("proyecto:"),
    p_jurados: elegidos("jurado:"),
  });
  // 42501 = la base rechazó la asignación (por ejemplo, un proyecto que volvió a borrador mientras tanto).
  if (error?.code === "42501") volver(eventoId, "error", "No se guardó nada: algún equipo está en borrador o alguna persona ya no es jurado. Recargá y probá de nuevo.");
  // 23503 = un salón que ya no existe (lo borraron en otra pestaña).
  if (error?.code === "23503") volver(eventoId, "error", "No se guardó nada: uno de los salones ya no existe. Recargá y probá de nuevo.");
  if (error) throw error;
  volver(eventoId, "ok", "Asignaciones guardadas.");
}
