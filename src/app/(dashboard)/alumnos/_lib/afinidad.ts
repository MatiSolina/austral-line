// GRUPO ALUMNOS — cómo se calcula qué tan afín es otro alumno, a partir de las estrellas (1 a 5)
// que cada uno le puso a cada tema del maestro de intereses.
// - Suma por cada tema que a los dos les interesa mucho (4 o 5 estrellas).
// - Suma por ser de otra carrera (interdisciplinariedad).
// - Resta por cada tema que a uno le interesa mucho y al otro casi nada (1 o 2 estrellas).
// Un tema sin calificar no suma ni resta.

export type Estrellas = Map<number, number>; // interes_id -> estrellas

export const UMBRAL = { mucho: 4, poco: 2 } as const;
export const PUNTOS = { temaEnComun: 2, otraCarrera: 3, choque: 3 } as const;

export function calcularAfinidad(
  yo: { carrera: string; estrellas: Estrellas },
  otro: { carrera: string; estrellas: Estrellas },
  nombreTema: (id: number) => string,
) {
  const enComun: string[] = [];
  const choques: string[] = [];
  for (const [id, mias] of yo.estrellas) {
    const suyas = otro.estrellas.get(id);
    if (suyas === undefined) continue;
    if (mias >= UMBRAL.mucho && suyas >= UMBRAL.mucho) enComun.push(nombreTema(id));
    else if ((mias >= UMBRAL.mucho && suyas <= UMBRAL.poco) || (suyas >= UMBRAL.mucho && mias <= UMBRAL.poco)) {
      choques.push(nombreTema(id));
    }
  }
  const [mia, suya] = [yo.carrera.trim().toLowerCase(), otro.carrera.trim().toLowerCase()];
  const otraCarrera = mia !== "" && suya !== "" && mia !== suya;
  const puntaje =
    enComun.length * PUNTOS.temaEnComun + (otraCarrera ? PUNTOS.otraCarrera : 0) - choques.length * PUNTOS.choque;

  const nivel = puntaje >= 5 ? "Muy afín" : puntaje >= 2 ? "Afín" : "Poco afín";
  return { puntaje, nivel, enComun, choques, otraCarrera };
}
