// GRUPO AUSTRAL — motor de matching alumno ↔ proyecto. Cálculo fijo y explicable (no depende de la IA).
// Cada criterio da un valor de 0 a 1 y el puntaje final es el promedio ponderado × 100.
// Si falta un dato para un criterio, ese criterio vale DATO_FALTANTE (bien por debajo de la mitad): sin información no hay
// puntajes altos, y además se genera una alerta.
// La idea central: no gana quien más sabe, sino quien más le suma al equipo. Por eso pesan la complementariedad
// (cubre lo que el equipo busca y no tiene) y el equilibrio (no recarga una categoría que ya sobra).

export type Categoria = "diseno" | "tecnologia" | "negocios" | "operaciones";
export const categorias: Record<Categoria, string> = {
  diseno: "Diseño",
  tecnologia: "Programación y tecnología",
  negocios: "Negocios",
  operaciones: "Operaciones y gestión",
};
export const niveles: Record<number, string> = { 1: "Básico", 2: "Intermedio", 3: "Avanzado" };
export const franjas: Record<string, string> = { manana: "Mañana", tarde: "Tarde", noche: "Noche", fin_de_semana: "Fin de semana" };
export const modalidades: Record<string, string> = { presencial: "Presencial", remota: "Remota", mixta: "Mixta" };

export type Habilidad = { id: number; nombre: string; categoria: Categoria };
export type HabilidadConNivel = Habilidad & { nivel: number };

export type Alumno = {
  id: string;
  nombre: string;
  carrera: string | null;
  anio: number | null;
  habilidades: HabilidadConNivel[];
  intereses: Map<number, number>; // tema → estrellas (1 a 5)
  disponibilidad: string[];
  modalidad: string | null;
};

export type Proyecto = {
  id: string;
  nombre: string;
  buscadas: Habilidad[];
  intereses: Map<number, number>; // tema → estrellas que le puso el grupo
  integrantes: { nombre: string; carrera: string | null; habilidades: HabilidadConNivel[] }[];
  disponibilidad: string[];
  modalidad: string | null;
  vacantes: number; // lugares libres (descontando propuestas aceptadas sin confirmar)
};

export type Pesos = {
  habilidades: number;
  complementariedad: number;
  intereses: number;
  formacion: number;
  disponibilidad: number;
  equilibrio: number;
};
export const criterios: Record<keyof Pesos, string> = {
  habilidades: "Habilidades",
  complementariedad: "Complementariedad",
  intereses: "Intereses",
  formacion: "Formación",
  disponibilidad: "Disponibilidad",
  equilibrio: "Equilibrio del equipo",
};

const DATO_FALTANTE = 0.25;
const POR_PERSONA = 2;
const POR_NIVEL: Record<number, number> = { 1: 0.5, 2: 0.8, 3: 1 };

// Afinidad de cada carrera con las categorías de habilidades. Solo suma cuando la formación se relaciona con lo que el
// equipo necesita; una carrera que no está acá queda neutra (nunca se penaliza por la carrera).
const afinidadCarrera: Record<string, Categoria[]> = {
  "Administración de Empresas": ["negocios", "operaciones"],
  "Negocios Digitales": ["negocios", "tecnologia"],
  "Economía Empresarial": ["negocios"],
  Agronegocios: ["negocios", "operaciones"],
  Marketing: ["negocios", "diseno"],
};

// Lo que un equipo ya tiene cubierto: habilidad en nivel intermedio o avanzado de algún integrante.
export function cubiertas(p: Pick<Proyecto, "integrantes">) {
  return new Set(p.integrantes.flatMap((i) => i.habilidades.filter((h) => h.nivel >= 2).map((h) => h.id)));
}
export function faltantes(p: Pick<Proyecto, "integrantes" | "buscadas">) {
  const ya = cubiertas(p);
  return p.buscadas.filter((h) => !ya.has(h.id));
}

// Peso de cada categoría en el equipo: cada integrante reparte 1 entre las categorías de sus habilidades (nivel ≥ 2).
export function distribucion(integrantes: { habilidades: HabilidadConNivel[] }[]) {
  const total: Record<Categoria, number> = { diseno: 0, tecnologia: 0, negocios: 0, operaciones: 0 };
  for (const i of integrantes) {
    const fuertes = i.habilidades.filter((h) => h.nivel >= 2);
    for (const h of fuertes) total[h.categoria] += 1 / fuertes.length;
  }
  return total;
}

// Qué tan parejo es el reparto entre las 4 categorías: 1 = todas iguales, 0 = todo en una sola.
function parejo(d: Record<Categoria, number>) {
  const valores = Object.values(d);
  const suma = valores.reduce((a, b) => a + b, 0);
  if (suma === 0) return 0;
  const proporciones = valores.map((v) => v / suma);
  const entropia = -proporciones.filter((x) => x > 0).reduce((a, x) => a + x * Math.log(x), 0);
  return entropia / Math.log(valores.length);
}

export type Resultado = {
  alumno: Alumno;
  proyecto: Proyecto;
  puntaje: number;
  valores: Record<keyof Pesos, number | null>; // null = faltó información
  aporte: string | null; // principal habilidad que aporta
  cubre: Habilidad[]; // habilidades buscadas y faltantes que cubre
  alertas: string[];
  justificacion: string;
};

const lista = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs.at(-1)}`);

export function evaluar(a: Alumno, p: Proyecto, pesos: Pesos): Resultado {
  const delAlumno = new Map(a.habilidades.map((h) => [h.id, h]));
  const falta = faltantes(p);
  const alertas: string[] = [];

  // 1. Habilidades: cuánto de lo que busca el proyecto sabe el alumno (por nivel; otra habilidad de la misma categoría suma poco).
  // Una sola persona no cubre todo lo que busca un equipo: dominar bien POR_PERSONA de esas habilidades ya es el máximo.
  let habilidades: number | null = null;
  if (p.buscadas.length && a.habilidades.length) {
    const suma = p.buscadas.reduce((acc, b) => {
      const propia = delAlumno.get(b.id);
      if (propia) return acc + POR_NIVEL[propia.nivel];
      return acc + (a.habilidades.some((h) => h.categoria === b.categoria) ? 0.25 : 0);
    }, 0);
    habilidades = Math.min(1, suma / Math.min(p.buscadas.length, POR_PERSONA));
  }

  // 2. Complementariedad: cuánto de lo que el equipo busca y NO tiene cubre el alumno (mismo tope por persona).
  const cubre = falta.filter((h) => delAlumno.has(h.id));
  let complementariedad: number | null = null;
  if (a.habilidades.length && p.buscadas.length) {
    if (falta.length) {
      complementariedad = Math.min(1, cubre.reduce((acc, h) => acc + POR_NIVEL[delAlumno.get(h.id)!.nivel], 0) / Math.min(falta.length, POR_PERSONA));
    } else {
      // El equipo ya cubre todo lo que busca: suma algo si trae categorías que el equipo no tiene.
      const delEquipo = new Set(p.integrantes.flatMap((i) => i.habilidades.map((h) => h.categoria)));
      complementariedad = a.habilidades.some((h) => h.nivel >= 2 && !delEquipo.has(h.categoria)) ? 0.6 : 0.3;
    }
  }

  // 3. Intereses: en los temas que más le importan al grupo (4 o 5 estrellas), cuánto le interesan al alumno.
  let intereses: number | null = null;
  const temasDelGrupo = [...p.intereses].filter(([, e]) => e >= 4).map(([t]) => t);
  const calificados = temasDelGrupo.filter((t) => a.intereses.has(t));
  if (calificados.length) intereses = calificados.reduce((acc, t) => acc + (a.intereses.get(t)! - 1) / 4, 0) / calificados.length;

  // 4. Formación: si su carrera se relaciona con lo que falta en el equipo; y suma diversidad si es de otra carrera.
  let formacion: number | null = null;
  if (a.carrera) {
    const afines = afinidadCarrera[a.carrera];
    const necesarias = new Set((falta.length ? falta : p.buscadas).map((h) => h.categoria));
    const relacion = !afines ? 0.5 : afines.some((c) => necesarias.has(c)) ? 1 : 0.5;
    const nueva = !p.integrantes.some((i) => i.carrera === a.carrera);
    formacion = Math.min(1, relacion * 0.8 + (nueva ? 0.2 : 0.1));
  }

  // 5. Disponibilidad: franjas en común y modalidad compatible (mixta va con todo).
  let disponibilidad: number | null = null;
  const conflictoModalidad = !!a.modalidad && !!p.modalidad && a.modalidad !== "mixta" && p.modalidad !== "mixta" && a.modalidad !== p.modalidad;
  if (a.disponibilidad.length && p.disponibilidad.length) {
    const comunes = p.disponibilidad.filter((f) => a.disponibilidad.includes(f)).length;
    disponibilidad = (comunes / p.disponibilidad.length) * (conflictoModalidad ? 0.3 : 1);
    if (comunes === 0) alertas.push("No comparte ninguna franja horaria con el equipo.");
  } else if (a.modalidad && p.modalidad) {
    disponibilidad = conflictoModalidad ? 0.2 : 0.7;
  }
  if (conflictoModalidad) alertas.push(`Prefiere modalidad ${modalidades[a.modalidad!].toLowerCase()} y el equipo trabaja en modalidad ${modalidades[p.modalidad!].toLowerCase()}.`);

  // 6. Equilibrio: cuánto mejora el reparto de categorías del equipo si se suma.
  let equilibrio: number | null = null;
  if (a.habilidades.some((h) => h.nivel >= 2)) {
    const antes = distribucion(p.integrantes);
    const despues = distribucion([...p.integrantes, a]);
    const nuevaCategoria = (Object.keys(despues) as Categoria[]).some((c) => antes[c] === 0 && despues[c] > 0);
    const mejora = parejo(despues) - parejo(antes);
    equilibrio = nuevaCategoria ? 1 : Math.max(0, Math.min(1, 0.5 + mejora * 2));
  }

  const valores = { habilidades, complementariedad, intereses, formacion, disponibilidad, equilibrio };
  const faltan = (Object.keys(valores) as (keyof Pesos)[]).filter((k) => valores[k] === null);
  const totalPesos = Object.values(pesos).reduce((x, y) => x + y, 0) || 1;
  const puntaje = Math.round(
    ((Object.keys(valores) as (keyof Pesos)[]).reduce((acc, k) => acc + (valores[k] ?? DATO_FALTANTE) * pesos[k], 0) / totalPesos) * 100,
  );
  if (!a.habilidades.length) alertas.push("El alumno no tiene habilidades cargadas: la recomendación no es confiable.");
  else if (faltan.length >= 2) alertas.push(`Falta información para: ${lista(faltan.map((k) => criterios[k].toLowerCase()))}.`);

  const fuertes = [...a.habilidades].sort((x, y) => y.nivel - x.nivel);
  const aporte = cubre.length
    ? cubre.sort((x, y) => delAlumno.get(y.id)!.nivel - delAlumno.get(x.id)!.nivel)[0].nombre
    : fuertes[0]?.nombre ?? null;

  return { alumno: a, proyecto: p, puntaje, valores, aporte, cubre, alertas, justificacion: justificar(a, p, valores, cubre, falta, puntaje) };
}

// Explicación en lenguaje natural, armada solo con lo que se calculó.
function justificar(a: Alumno, p: Proyecto, v: Resultado["valores"], cubre: Habilidad[], falta: Habilidad[], puntaje: number) {
  const partes = [`Compatibilidad del ${puntaje}%.`];
  if (!a.habilidades.length) return `${partes[0]} No tiene habilidades cargadas, así que no se puede evaluar qué le aportaría al equipo.`;
  const nivelDe = (h: Habilidad) => niveles[a.habilidades.find((x) => x.id === h.id)!.nivel].toLowerCase();
  if (cubre.length) {
    partes.push(`Aporta ${lista(cubre.map((h) => `${h.nombre} (${nivelDe(h)})`))}, ${cubre.length === 1 ? "una habilidad que el equipo busca y" : "habilidades que el equipo busca y"} hoy no tiene cubierta${cubre.length === 1 ? "" : "s"}.`);
  } else if (falta.length) {
    partes.push(`No cubre lo que el equipo más necesita (${lista(falta.map((h) => h.nombre))}).`);
  }
  if ((v.habilidades ?? 0) >= 0.6 && !cubre.length) partes.push("Sus habilidades coinciden con varias de las que busca el proyecto, aunque el equipo ya las tiene.");
  if (v.intereses !== null) {
    partes.push(v.intereses >= 0.6 ? "Sus intereses coinciden con la temática del proyecto." : v.intereses < 0.35 ? "La temática del proyecto no está entre sus intereses principales." : "Sus intereses coinciden en parte con la temática del proyecto.");
  }
  if (v.equilibrio !== null && v.equilibrio >= 0.8) partes.push("Su incorporación equilibra la distribución de perfiles del equipo.");
  else if (v.equilibrio !== null && v.equilibrio < 0.4) partes.push("Su perfil se parece al de integrantes actuales, así que suma poco al equilibrio del equipo.");
  if (v.disponibilidad !== null) partes.push(v.disponibilidad >= 0.6 ? "Su disponibilidad es compatible con la del grupo." : "Su disponibilidad coincide poco con la del grupo.");
  if (v.formacion !== null && v.formacion >= 0.9 && a.carrera) partes.push(`Su formación en ${a.carrera} se relaciona con lo que necesita el equipo.`);
  return partes.join(" ");
}

// Plan global sugerido: de mayor a menor puntaje, cada alumno a un solo proyecto y sin pasarse de las vacantes.
export function planSugerido(resultados: Resultado[], minimo: number) {
  const ocupados = new Set<string>();
  const lugares = new Map<string, number>();
  const plan = new Set<string>();
  for (const r of [...resultados].sort((x, y) => y.puntaje - x.puntaje)) {
    if (r.puntaje < minimo || ocupados.has(r.alumno.id)) continue;
    const libres = lugares.get(r.proyecto.id) ?? r.proyecto.vacantes;
    if (libres <= 0) continue;
    lugares.set(r.proyecto.id, libres - 1);
    ocupados.add(r.alumno.id);
    plan.add(`${r.alumno.id}:${r.proyecto.id}`);
  }
  return plan;
}

export type Alerta = { tipo: string; titulo: string; detalle: string; accion: string; proyectoId?: string; alumnoId?: string };

// Situaciones que necesitan intervención del admin, cada una con su acción sugerida.
export function alertas(alumnos: Alumno[], proyectos: Proyecto[], resultados: Resultado[], minimo: number): Alerta[] {
  const salida: Alerta[] = [];
  for (const p of proyectos) {
    if (p.vacantes <= 0) continue;
    const ranking = resultados.filter((r) => r.proyecto.id === p.id).sort((x, y) => y.puntaje - x.puntaje);
    if (!p.buscadas.length) {
      salida.push({ tipo: "datos", titulo: `${p.nombre}: faltan sus necesidades`, detalle: "El proyecto no tiene cargadas las habilidades que busca, así que no se puede evaluar bien a los candidatos.", accion: "Cargá las habilidades que busca el equipo.", proyectoId: p.id });
      continue;
    }
    if (!ranking.some((r) => r.puntaje >= minimo)) {
      salida.push({ tipo: "sin_candidatos", titulo: `${p.nombre}: sin candidatos suficientes`, detalle: `Ningún alumno sin grupo llega al puntaje mínimo (${minimo}).`, accion: "Revisá si sus necesidades son realistas, bajá el puntaje mínimo o buscá alumnos por fuera de la lista.", proyectoId: p.id });
    } else {
      // Empate que importa: en el primer puesto, o justo en el corte de los lugares libres (uno entra y el otro no).
      const corte = Math.min(p.vacantes, ranking.length - 1);
      const par = [[0, 1], [corte - 1, corte]].find(([i, j]) => i >= 0 && j < ranking.length && i < j && ranking[j].puntaje >= minimo && ranking[i].puntaje - ranking[j].puntaje <= 3);
      if (par) {
        const [x, y] = par.map((i) => ranking[i]);
        salida.push({ tipo: "empate", titulo: `${p.nombre}: candidatos parejos`, detalle: `${x.alumno.nombre} (${x.puntaje}) y ${y.alumno.nombre} (${y.puntaje}) tienen puntajes casi iguales${par[0] > 0 ? " y compiten por el último lugar libre" : ""}.`, accion: "Compará los dos perfiles antes de decidir; puede servir hablar con el equipo.", proyectoId: p.id });
      }
    }
    const disponibles = new Set(alumnos.flatMap((a) => a.habilidades.map((h) => h.id)));
    const sinNadie = faltantes(p).filter((h) => !disponibles.has(h.id));
    if (sinNadie.length) {
      salida.push({ tipo: "habilidad", titulo: `${p.nombre}: nadie tiene ${lista(sinNadie.map((h) => h.nombre))}`, detalle: "Ningún alumno sin grupo declaró esa habilidad, que el equipo busca y no tiene.", accion: "Considerá sumar a alguien de otro equipo, un mentor, o que el equipo se capacite.", proyectoId: p.id });
    }
    const d = distribucion(p.integrantes);
    const total = Object.values(d).reduce((a, b) => a + b, 0);
    const [mayor, valor] = (Object.entries(d) as [Categoria, number][]).sort((x, y) => y[1] - x[1])[0];
    if (p.integrantes.length >= 2 && total > 0 && valor / total >= 0.75) {
      salida.push({ tipo: "desequilibrio", titulo: `${p.nombre}: equipo desbalanceado`, detalle: `El ${Math.round((valor / total) * 100)}% de los perfiles del equipo es de ${categorias[mayor]}.`, accion: "Priorizá candidatos de otras categorías aunque tengan menos coincidencia directa.", proyectoId: p.id });
    }
  }
  for (const a of alumnos) {
    const suyos = resultados.filter((r) => r.alumno.id === a.id).sort((x, y) => y.puntaje - x.puntaje);
    if (!a.habilidades.length || suyos[0]?.alertas.some((x) => x.startsWith("Falta información"))) {
      salida.push({ tipo: "datos", titulo: `${a.nombre}: información insuficiente`, detalle: "Le faltan datos (habilidades, disponibilidad o intereses) para recomendarlo con confianza.", accion: "Completá su perfil de matching.", alumnoId: a.id });
    } else if (suyos[0]?.alertas.length) {
      salida.push({ tipo: "conflicto", titulo: `${a.nombre}: conflicto con su mejor opción`, detalle: `Con ${suyos[0].proyecto.nombre}: ${suyos[0].alertas.join(" ")}`, accion: "Confirmá con el alumno si puede adaptarse antes de proponerlo.", alumnoId: a.id, proyectoId: suyos[0].proyecto.id });
    }
  }
  return salida;
}
