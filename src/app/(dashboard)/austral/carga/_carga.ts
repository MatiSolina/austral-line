// GRUPO AUSTRAL — carga masiva de la materia: qué columnas tiene cada CSV y cómo se valida cada fila.
// Lo usan la vista previa y la importación (las dos en el servidor, con los mismos datos de la base).
import { leerCsv } from "../matching/_csv";

export type Tipo = "mentores" | "jurados" | "alumnos" | "proyectos";
export type Rol = "mentor" | "jurado" | "alumno";

export const tipos: Record<Tipo, { titulo: string; columnas: string[]; ejemplo: string; rol?: Rol; ayuda: string }> = {
  mentores: {
    titulo: "Mentores",
    rol: "mentor",
    columnas: ["nombre", "email", "telefono", "especialidad"],
    ejemplo: "Laura Gómez;laura@empresa.com;11 5555-1234;Finanzas y fintech",
    ayuda: "Especialidad: en qué puede ayudar a los equipos.",
  },
  jurados: {
    titulo: "Jurados",
    rol: "jurado",
    columnas: ["nombre", "email", "telefono", "especialidad"],
    ejemplo: "Martín Ruiz;martin@fondo.com;11 5555-9876;Inversión en startups",
    ayuda: "Especialidad: su área o industria como evaluador.",
  },
  alumnos: {
    titulo: "Alumnos",
    rol: "alumno",
    columnas: ["nombre", "email", "telefono", "carrera"],
    ejemplo: "Sofía Díaz;sofia.diaz@alumnos.austral.edu.ar;11 5555-0000;Marketing",
    ayuda: "Carrera: una de las carreras cargadas por el grupo Alumnos.",
  },
  proyectos: {
    titulo: "Proyectos",
    columnas: ["nombre", "participantes"],
    ejemplo: "AgroSense;ana@alumnos.austral.edu.ar|tomas@alumnos.austral.edu.ar",
    ayuda: "Participantes: emails de alumnos separados con |. Cargá primero los alumnos.",
  },
};

export const plantilla = (tipo: Tipo) => `${tipos[tipo].columnas.join(";")}\n${tipos[tipo].ejemplo}\n`;

export type Fila = {
  linea: number;
  datos: Record<string, string>;
  accion: "nuevo" | "actualiza" | null; // qué va a pasar si se importa
  personaId: string | null; // persona existente (personas) o proyecto existente (proyectos)
  carreraId: number | null;
  participantes: { email: string; id: string }[];
  errores: string[];
};

export type Contexto = {
  personas: { id: string; nombre: string; email: string; rol: string }[];
  carreras: { id: number; nombre: string }[];
  proyectos: { id: string; nombre: string }[];
};

const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const emailValido = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const rolTexto: Record<string, string> = { admin: "admin", alumno: "alumno", mentor: "mentor", jurado: "jurado" };

export function validar(tipo: Tipo, texto: string, ctx: Contexto): { filas: Fila[]; errorGeneral: string | null } {
  const tabla = leerCsv(texto);
  if (tabla.length < 2) return { filas: [], errorGeneral: "El archivo está vacío o solo tiene encabezados." };
  const encabezado = tabla[0].map(normal);
  const faltan = tipos[tipo].columnas.filter((c) => !encabezado.includes(c));
  if (faltan.length) return { filas: [], errorGeneral: `Faltan columnas en la primera fila: ${faltan.join(", ")}.` };
  const valor = (celdas: string[], c: string) => (celdas[encabezado.indexOf(c)] ?? "").trim();
  const porEmail = new Map(ctx.personas.map((p) => [p.email.toLowerCase(), p]));
  const vistos = new Set<string>();

  const filas = tabla.slice(1).map((celdas, k): Fila => {
    const datos = Object.fromEntries(tipos[tipo].columnas.map((c) => [c, valor(celdas, c)]));
    const fila: Fila = { linea: k + 2, datos, accion: null, personaId: null, carreraId: null, participantes: [], errores: [] };
    if (!datos.nombre) fila.errores.push("Falta el nombre.");
    else if (datos.nombre.length > 120) fila.errores.push("El nombre es demasiado largo.");

    if (tipo === "proyectos") {
      const clave = normal(datos.nombre);
      if (clave && vistos.has(clave)) fila.errores.push("El proyecto está repetido en el archivo.");
      vistos.add(clave);
      const existente = ctx.proyectos.find((p) => normal(p.nombre) === clave);
      fila.personaId = existente?.id ?? null;
      fila.accion = existente ? "actualiza" : "nuevo";
      const emails = [...new Set(datos.participantes.split("|").map((e) => e.trim().toLowerCase()).filter(Boolean))];
      if (!emails.length) fila.errores.push("Falta al menos un participante.");
      for (const email of emails) {
        const p = porEmail.get(email);
        if (!p) fila.errores.push(`${email} no está cargado (cargalo primero en Alumnos).`);
        else if (p.rol !== "alumno") fila.errores.push(`${email} no es alumno (es ${rolTexto[p.rol] ?? p.rol}).`);
        else fila.participantes.push({ email, id: p.id });
      }
      return fila;
    }

    const email = datos.email.toLowerCase();
    if (!email) fila.errores.push("Falta el email.");
    else if (!emailValido(email)) fila.errores.push(`Email inválido: ${datos.email}.`);
    else if (vistos.has(email)) fila.errores.push("El email está repetido en el archivo.");
    vistos.add(email);
    const existente = porEmail.get(email);
    if (existente && existente.rol !== tipos[tipo].rol) {
      fila.errores.push(`Ya existe con el rol ${rolTexto[existente.rol] ?? existente.rol}: el rol se cambia desde Miembros.`);
    }
    fila.personaId = existente?.id ?? null;
    fila.accion = existente ? "actualiza" : "nuevo";
    if (datos.telefono && !/^[\d\s()+\-.]{6,40}$/.test(datos.telefono)) fila.errores.push(`Teléfono inválido: ${datos.telefono}.`);
    if ((datos.especialidad ?? "").length > 200) fila.errores.push("La especialidad es demasiado larga.");
    if (tipo === "alumnos" && datos.carrera) {
      const carrera = ctx.carreras.find((c) => normal(c.nombre) === normal(datos.carrera));
      if (carrera) fila.carreraId = carrera.id;
      else fila.errores.push(`Carrera desconocida: "${datos.carrera}" (usá: ${ctx.carreras.map((c) => c.nombre).join(", ")}).`);
    }
    return fila;
  });
  return { filas, errorGeneral: null };
}
