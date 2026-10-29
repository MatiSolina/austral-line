"use server";
// GRUPO AUSTRAL — acciones del panel de preparación de jurados. Todas son solo para el admin.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { generarMaterial } from "./agente";

// `volver` es la pantalla desde donde se mandó el formulario (el panel o la revisión de un proyecto).
function volver(formData: FormData, tipo: "ok" | "error", mensaje: string): never {
  revalidatePath("/austral", "layout");
  const pedido = String(formData.get("volver") ?? "");
  const destino = pedido.startsWith("/austral/preparacion") ? pedido : "/austral/preparacion";
  const separador = destino.includes("?") ? "&" : "?";
  redirect(`${destino}${separador}${tipo}=${encodeURIComponent(mensaje)}`);
}

export async function generar(formData: FormData) {
  const persona = await requireRol();
  const supabase = await createClient();
  const resultado = await generarMaterial(supabase, String(formData.get("proyecto_id")), persona.id);
  volver(formData, resultado.ok ? "ok" : "error", resultado.mensaje);
}

const texto = (formData: FormData, campo: string) => String(formData.get(campo) ?? "").trim() || null;

// Guarda lo que editó el admin. Con `aprobar`, además lo publica para los jurados de su salón.
export async function guardar(formData: FormData) {
  const persona = await requireRol();
  const supabase = await createClient();
  const aprobar = formData.get("accion") === "aprobar";
  const campos = {
    sector: texto(formData, "sector"),
    contexto: texto(formData, "contexto"),
    problematica: texto(formData, "problematica"),
    guion: texto(formData, "guion"),
  };
  if (aprobar && (!campos.contexto || !campos.problematica || !campos.guion)) {
    volver(formData, "error", "Para aprobar, completá el contexto, la problemática y el guion.");
  }
  const { error } = await supabase
    .from("austral_materiales")
    .update({
      ...campos,
      updated_at: new Date().toISOString(),
      ...(aprobar && { estado: "aprobado", aviso: null, aprobado_por: persona.id, aprobado_at: new Date().toISOString() }),
    })
    .eq("id", String(formData.get("material_id")));
  if (error) throw error;
  volver(formData, "ok", aprobar ? "Material aprobado: ya lo ven los jurados de su salón." : "Cambios guardados.");
}

export async function despublicar(formData: FormData) {
  await requireRol();
  const supabase = await createClient();
  const { error } = await supabase
    .from("austral_materiales")
    .update({ estado: "borrador", aprobado_por: null, aprobado_at: null, updated_at: new Date().toISOString() })
    .eq("id", String(formData.get("material_id")));
  if (error) throw error;
  volver(formData, "ok", "El material volvió a borrador: los jurados ya no lo ven.");
}
