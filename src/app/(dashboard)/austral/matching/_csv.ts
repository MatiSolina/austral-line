// GRUPO AUSTRAL — lectura y validación del CSV de perfiles de matching. Lo usan la vista previa (en el navegador)
// y la importación (en el servidor, que vuelve a validar todo antes de guardar).
// Columnas: email, anio, area, experiencia, disponibilidad, modalidad, preferencias, habilidades.
// Una celda vacía no cambia ese dato; "habilidades", si viene, reemplaza todas las del alumno.

export const columnas = ["email", "anio", "area", "experiencia", "disponibilidad", "modalidad", "preferencias", "habilidades"] as const;

export const plantilla =
  "email;anio;area;experiencia;disponibilidad;modalidad;preferencias;habilidades\n" +
  "alumno@alumnos.austral.edu.ar;3;Diseño de producto;Hizo la web de un emprendimiento;tarde|noche;mixta;Educación;UX/UI:avanzado|Prototipado:intermedio\n";

export type Fila = {
  linea: number;
  email: string;
  personaId: string | null;
  nombre: string | null;
  cambios: { anio?: number | null; area?: string; experiencia?: string; disponibilidad?: string[]; modalidad?: string; preferencias?: string };
  habilidades: { id: number; nombre: string; nivel: number }[] | null; // null = no se tocan
  errores: string[];
};

// Alumnos de personas_contacto que se pueden reconocer en el CSV (el admin ve todos los mails; igual descartamos nulos).
export const alumnosConEmail = (filas: { id: string | null; nombre: string | null; email: string | null }[]) =>
  filas.filter((a): a is { id: string; nombre: string; email: string } => !!a.id && !!a.nombre && !!a.email);

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// CSV simple con comillas; el separador es ";" (Excel en español) o ",".
export function leerCsv(texto: string): string[][] {
  const limpio = texto.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const primera = limpio.split("\n")[0] ?? "";
  const sep = (primera.match(/;/g)?.length ?? 0) >= (primera.match(/,/g)?.length ?? 0) ? ";" : ",";
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let entreComillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (entreComillas) {
      if (c === '"' && limpio[i + 1] === '"') { celda += '"'; i++; }
      else if (c === '"') entreComillas = false;
      else celda += c;
    } else if (c === '"') entreComillas = true;
    else if (c === sep) { fila.push(celda); celda = ""; }
    else if (c === "\n") { fila.push(celda); filas.push(fila); fila = []; celda = ""; }
    else celda += c;
  }
  if (celda || fila.length) { fila.push(celda); filas.push(fila); }
  return filas.filter((f) => f.some((x) => x.trim()));
}

const franjasValidas: Record<string, string> = { manana: "manana", tarde: "tarde", noche: "noche", "fin de semana": "fin_de_semana", fin_de_semana: "fin_de_semana" };
const nivelesValidos: Record<string, number> = { "1": 1, "2": 2, "3": 3, basico: 1, intermedio: 2, avanzado: 3 };

export function validar(
  texto: string,
  catalogo: { id: number; nombre: string }[],
  alumnos: { id: string; nombre: string; email: string }[],
): { filas: Fila[]; errorGeneral: string | null } {
  const tabla = leerCsv(texto);
  if (tabla.length < 2) return { filas: [], errorGeneral: "El archivo está vacío o solo tiene encabezados." };
  const encabezado = tabla[0].map(sinTildes);
  if (!encabezado.includes("email")) return { filas: [], errorGeneral: "Falta la columna \"email\" en la primera fila." };
  const desconocidas = encabezado.filter((c) => c && !(columnas as readonly string[]).includes(c));
  const indice = (c: string) => encabezado.indexOf(c);
  const habilidadPorNombre = new Map(catalogo.map((h) => [sinTildes(h.nombre), h]));
  const alumnoPorEmail = new Map(alumnos.map((a) => [a.email.toLowerCase(), a]));
  const vistos = new Set<string>();

  const filas = tabla.slice(1).map((celdas, k): Fila => {
    const valor = (c: string) => (indice(c) >= 0 ? (celdas[indice(c)] ?? "").trim() : "");
    const email = valor("email").toLowerCase();
    const alumno = alumnoPorEmail.get(email);
    const errores: string[] = [];
    if (!email) errores.push("Falta el email.");
    else if (!alumno) errores.push("No hay ningún alumno con ese email en la app (se suman desde Miembros).");
    else if (vistos.has(email)) errores.push("El email está repetido en el archivo.");
    vistos.add(email);

    const cambios: Fila["cambios"] = {};
    const anio = valor("anio");
    if (anio) {
      const n = Number(anio);
      if (Number.isInteger(n) && n >= 1 && n <= 6) cambios.anio = n;
      else errores.push(`Año "${anio}" inválido (1 a 6).`);
    }
    for (const c of ["area", "experiencia", "preferencias"] as const) if (valor(c)) cambios[c] = valor(c).slice(0, c === "area" ? 200 : 1000);
    const disp = valor("disponibilidad");
    if (disp) {
      const partes = disp.split(/[|/]/).map(sinTildes).filter(Boolean);
      const malas = partes.filter((p) => !franjasValidas[p]);
      if (malas.length) errores.push(`Disponibilidad desconocida: ${malas.join(", ")} (usá mañana, tarde, noche o fin de semana).`);
      else cambios.disponibilidad = [...new Set(partes.map((p) => franjasValidas[p]))];
    }
    const modalidad = sinTildes(valor("modalidad"));
    if (modalidad) {
      if (["presencial", "remota", "mixta"].includes(modalidad)) cambios.modalidad = modalidad;
      else errores.push(`Modalidad "${valor("modalidad")}" inválida (presencial, remota o mixta).`);
    }

    let habilidades: Fila["habilidades"] = null;
    const textoHabilidades = valor("habilidades");
    if (textoHabilidades) {
      habilidades = [];
      for (const parte of textoHabilidades.split("|").map((p) => p.trim()).filter(Boolean)) {
        const corte = parte.lastIndexOf(":");
        const nombre = corte > 0 ? parte.slice(0, corte) : parte;
        const nivel = corte > 0 ? nivelesValidos[sinTildes(parte.slice(corte + 1))] : undefined;
        const h = habilidadPorNombre.get(sinTildes(nombre));
        if (!h) errores.push(`Habilidad desconocida: "${nombre.trim()}".`);
        // Una habilidad dos veces haría fallar el alta en la base.
        else if (habilidades.some((x) => x.id === h.id)) errores.push(`Habilidad repetida: ${h.nombre}.`);
        else if (corte <= 0) errores.push(`Falta el nivel de ${h.nombre} (por ejemplo ${h.nombre}:intermedio).`);
        else if (!nivel) errores.push(`Nivel inválido para ${h.nombre} (básico, intermedio o avanzado).`);
        else habilidades.push({ id: h.id, nombre: h.nombre, nivel });
      }
    }
    if (!errores.length && !Object.keys(cambios).length && !habilidades) errores.push("La fila no trae ningún dato para cargar.");
    return { linea: k + 2, email, personaId: alumno?.id ?? null, nombre: alumno?.nombre ?? null, cambios, habilidades, errores };
  });
  return { filas, errorGeneral: desconocidas.length ? `Se ignoran columnas desconocidas: ${desconocidas.join(", ")}.` : null };
}
