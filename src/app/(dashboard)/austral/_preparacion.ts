// GRUPO AUSTRAL — lo que comparten las pantallas de preparación de jurados (alumnos, admin y jurados).
import type { createClient } from "@/lib/supabase/server";

export type Supabase = Awaited<ReturnType<typeof createClient>>;

export const BUCKET = "austral-documentos";
export const MAX_BYTES = 10 * 1024 * 1024; // igual que el límite del bucket

// Lo que el agente puede leer. La extensión manda: Windows a veces sube los .md sin tipo.
export const tiposPorExtension: Record<string, "application/pdf" | "text/plain" | "text/markdown"> = {
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
};
export const extensionesAceptadas = Object.keys(tiposPorExtension).map((e) => `.${e}`).join(",");

export const estados: Record<string, { texto: string; variante: "default" | "secondary" | "outline" | "destructive" }> = {
  borrador: { texto: "Para revisar", variante: "secondary" },
  revisar: { texto: "Con aviso", variante: "destructive" },
  aprobado: { texto: "Aprobado", variante: "default" },
};

// Un evento de hoy sigue contando como "próximo" hasta 12 h después de empezar.
export const recienEmpezado = () => new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

export const fechaHora =(iso: string) =>
  new Date(iso).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export const tamano = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

// Hubo cambios en los documentos desde que se generó el material (subieron o borraron alguno).
export function desactualizado(material: { documentos: string[] } | null | undefined, documentosActuales: string[]) {
  if (!material) return false;
  const usados = new Set(material.documentos);
  return usados.size !== documentosActuales.length || documentosActuales.some((id) => !usados.has(id));
}
