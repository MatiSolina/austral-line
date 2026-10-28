"use server";
// GRUPO AUSTRAL — registra que un jurado abrió o escuchó su material (para las métricas del panel del admin).
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function registrarUso(materialId: string, tipo: "lectura" | "audio") {
  const persona = await requireRol("jurado");
  if (persona.rol !== "jurado") return; // el admin mirando no cuenta
  const supabase = await createClient();
  // La policy solo deja registrar materiales aprobados de su salón; si no, no pasa nada.
  await supabase.from("austral_material_usos").insert({ material_id: materialId, jurado_id: persona.id, tipo });
}
