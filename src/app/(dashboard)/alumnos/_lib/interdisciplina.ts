// GRUPO ALUMNOS — regla de interdisciplinariedad de un grupo (definida con la cátedra):
// un grupo es interdisciplinario si sus integrantes son de 2 o más carreras distintas.

export const MINIMO_CARRERAS = 2;

export type EstadoGrupo = "Interdisciplinario" | "Faltan perfiles" | "Una sola carrera";

// carreras: la carrera de cada integrante, o undefined si todavía no la eligió.
export function evaluarGrupo(carreras: (string | undefined)[]) {
  const conocidas = carreras.filter((c): c is string => c !== undefined);
  const distintas = [...new Set(conocidas)];
  const sinCarrera = carreras.length - conocidas.length;
  const estado: EstadoGrupo =
    distintas.length >= MINIMO_CARRERAS ? "Interdisciplinario" : sinCarrera > 0 ? "Faltan perfiles" : "Una sola carrera";
  return { estado, distintas, sinCarrera };
}
