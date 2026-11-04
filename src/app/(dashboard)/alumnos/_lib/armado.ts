// GRUPO ALUMNOS — reglas del armado de grupos (definidas con la cátedra). La base las vuelve a validar.
export const MIN_INTEGRANTES = 2;
export const MAX_INTEGRANTES = 6;

const ZONA = "America/Argentina/Buenos_Aires";
export const fechaCierre = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: ZONA });
