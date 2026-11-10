// GRUPO ALUMNOS — cálculo del puntaje de un alumno. Por cada hito que vale puntos, cuenta la nota
// individual del alumno si existe (en hitos individuales, o un ajuste de los profesores en uno grupal);
// si no, la nota de su grupo.

export type HitoConPuntaje = { id: string; nombre: string; inicio: string; maximo: number };
export type Nota = { evento_id: string; proyecto_id: string | null; persona_id: string | null; puntos: number; comentario: string | null };

export type Fila = HitoConPuntaje & { puntos: number | null; origen: "grupo" | "individual" | null; comentario: string | null };

export function puntajeDe(alumnoId: string, proyectosDelAlumno: string[], hitos: HitoConPuntaje[], notas: Nota[]) {
  const filas: Fila[] = hitos.map((h) => {
    const propia = notas.find((n) => n.evento_id === h.id && n.persona_id === alumnoId);
    const grupal = notas.find((n) => n.evento_id === h.id && n.proyecto_id !== null && proyectosDelAlumno.includes(n.proyecto_id));
    const nota = propia ?? grupal;
    return {
      ...h,
      puntos: nota ? Number(nota.puntos) : null,
      origen: propia ? "individual" : grupal ? "grupo" : null,
      comentario: nota?.comentario ?? null,
    };
  });
  const total = filas.reduce((s, f) => s + (f.puntos ?? 0), 0);
  // Lo que todavía se puede sumar: el máximo de los hitos sin nota.
  const enJuego = filas.filter((f) => f.puntos === null).reduce((s, f) => s + f.maximo, 0);
  return { filas, total, enJuego };
}

export type Estado = "Regularizó" | "Puede regularizar" | "No llega" | "Sin mínimo";

export function estadoDe(total: number, enJuego: number, minimo: number | null): Estado {
  if (minimo === null) return "Sin mínimo";
  if (total >= minimo) return "Regularizó";
  return total + enJuego >= minimo ? "Puede regularizar" : "No llega";
}

export const numero = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
