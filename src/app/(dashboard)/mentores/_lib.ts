// GRUPO MENTORES — reglas compartidas del agente de carga de perfil.
import type { Tables } from "@/lib/database.types";

export type PerfilMentor = Tables<"mentores_perfil">;

// Campos que organiza el agente, en el orden en que se muestran y se confirman.
export const camposPerfil = [
  { campo: "empresa", label: "Empresa" },
  { campo: "cargo", label: "Cargo" },
  { campo: "industria", label: "Industria" },
  { campo: "anios_experiencia", label: "Años de experiencia" },
  { campo: "bio", label: "Sobre vos" },
  { campo: "areas_ayuda", label: "En qué podés ayudar a los alumnos" },
  { campo: "linkedin_url", label: "LinkedIn" },
] as const satisfies { campo: keyof PerfilMentor; label: string }[];

// Sin estos datos el perfil no dice nada útil a un alumno: hace falta completarlos para publicar.
export const camposObligatorios = ["bio", "areas_ayuda"] as const satisfies (keyof PerfilMentor)[];

export const esLinkedin = (link: string | null) => !!link && /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\//i.test(link);

export function erroresParaPublicar(perfil: Pick<PerfilMentor, (typeof camposObligatorios)[number]>) {
  return camposObligatorios.filter((campo) => !perfil[campo]?.trim());
}
