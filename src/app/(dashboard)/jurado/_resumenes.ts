// GRUPO JURADO — lo que comparten las pantallas del resumen del pitch (panel del admin, revisión y agente).
import type { createClient } from "@/lib/supabase/server";

export type Supabase = Awaited<ReturnType<typeof createClient>>;

export const BUCKET = "jurado-resumenes";
export const MAX_BYTES = 10 * 1024 * 1024; // igual que el límite del bucket

// Meta del documento de IA Lab: todo el material de un salón se escucha en menos de 15 minutos.
export const MINUTOS_POR_SALON = 15;
// Ritmo de lectura en voz alta (la voz del navegador va un poco más lento que una persona).
export const PALABRAS_POR_MINUTO = 140;

export type Tipo = "presentacion" | "transcripcion";

// Qué sube el admin por cada equipo. La extensión manda: Windows a veces sube los .vtt o .srt sin tipo.
export const tipos: Record<Tipo, { titulo: string; boton: string; extensiones: Record<string, "application/pdf" | "text/plain" | "text/vtt"> }> = {
  presentacion: { titulo: "Presentación final", boton: "Subir PDF", extensiones: { pdf: "application/pdf" } },
  transcripcion: {
    titulo: "Transcripción de la sesión grabada",
    boton: "Subir transcripción",
    extensiones: { txt: "text/plain", srt: "text/plain", vtt: "text/vtt" },
  },
};
export const extensiones = (tipo: Tipo) => Object.keys(tipos[tipo].extensiones).map((e) => `.${e}`).join(",");

export const estados: Record<string, { texto: string; variante: "default" | "secondary" | "outline" | "destructive" }> = {
  borrador: { texto: "Para revisar", variante: "secondary" },
  revisar: { texto: "Con aviso", variante: "destructive" },
  aprobado: { texto: "Aprobado", variante: "default" },
};

export const contarPalabras = (texto: string | null) => (texto ?? "").trim().split(/\s+/).filter(Boolean).length;

export function duracion(palabras: number) {
  const segundos = Math.round((palabras / PALABRAS_POR_MINUTO) * 60);
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  return min === 0 ? `${seg} s` : seg === 0 ? `${min} min` : `${min} min ${seg} s`;
}

// Cuántas palabras le tocan a cada equipo para que el salón entero no pase de 15 minutos (con 10% de margen).
// Con pocos equipos, igual se corta en 4 minutos: es un resumen, no la transcripción.
export const palabrasPorEquipo = (equiposDelSalon: number) =>
  Math.min(Math.floor((MINUTOS_POR_SALON * PALABRAS_POR_MINUTO * 0.9) / Math.max(1, equiposDelSalon)), 4 * PALABRAS_POR_MINUTO);

// Meta de entrega: aprobados antes de las 18:00 del día anterior al evento, hora argentina (siempre UTC-3).
export function limiteEntrega(inicioEvento: string) {
  const [dia, mes, anio] = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric" })
    .format(new Date(inicioEvento))
    .split("/");
  const fecha = new Date(`${anio}-${mes}-${dia}T18:00:00-03:00`);
  fecha.setUTCDate(fecha.getUTCDate() - 1);
  return fecha.toISOString();
}
export const yaPaso = (iso: string) => Date.now() > new Date(iso).getTime();

export const tamano = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

// Subieron o reemplazaron archivos después de generar el resumen.
export function desactualizado(resumen: { archivos: string[]; generado_at: string | null } | null | undefined, archivosActuales: string[]) {
  if (!resumen?.generado_at) return false;
  const usados = new Set(resumen.archivos);
  return usados.size !== archivosActuales.length || archivosActuales.some((id) => !usados.has(id));
}
