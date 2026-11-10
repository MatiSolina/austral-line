// GRUPO ALUMNOS — firma lo que guarda la IA para que la base sepa que viene del servidor y no del alumno.
// Solo se importa desde server actions. La clave real está en ALUMNOS_IA_FIRMA (Vercel) y en alumnos_ia_clave.
import { createHmac } from "node:crypto";

// ponytail: sin variable cae a la clave de desarrollo; en producción no coincide con la de la base y el guardado falla (seguro).
export const firmar = (id: string) =>
  createHmac("sha256", process.env.ALUMNOS_IA_FIRMA || "desarrollo-local-firma").update(id).digest("hex");
