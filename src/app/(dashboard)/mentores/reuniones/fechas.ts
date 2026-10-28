// GRUPO MENTORES — fechas en hora argentina (Argentina no tiene horario de verano: siempre UTC-3).

const zona = "America/Argentina/Buenos_Aires";

export const fechaHora = (iso: string) =>
  new Intl.DateTimeFormat("es-AR", {
    timeZone: zona, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(iso)) + " hs";

export const fechaCorta = (iso: string) =>
  new Intl.DateTimeFormat("es-AR", {
    timeZone: zona, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(iso));

// Valor de un <input type="datetime-local"> ("2026-10-21T15:00", hora argentina) → ISO. null si no es válido.
export function desdeInput(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) return null;
  const fecha = new Date(`${valor}:00-03:00`);
  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString();
}

// ISO → valor para un <input type="datetime-local"> en hora argentina.
export const paraInput = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(iso)).replace(" ", "T");
