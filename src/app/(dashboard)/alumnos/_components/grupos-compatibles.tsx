// GRUPO ALUMNOS — grupos con los que el grupo del alumno podría unirse (solo una sugerencia).
// Lo calcula la base (alumnos_grupos_compatibles): juntos no pasan de 6, comparten temas y suman carreras.
// Por privacidad, al alumno le llega solo el nombre del otro grupo, cuántos son y el puntaje; el detalle
// (temas, carreras) lo ven solo los profesores en su panel.
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/lib/database.types";

const MAXIMO = 2;
// Desde este puntaje (por ejemplo, 2 temas en común y suman una carrera) se muestran como "Muy compatibles".
const MUY_COMPATIBLES = 7;

type Par = Database["public"]["Functions"]["alumnos_grupos_compatibles"]["Returns"][number];

export async function GruposCompatibles({ proyectoId, pares }: { proyectoId: string; pares: Par[] }) {
  const otros = pares
    .filter((p) => p.proyecto_a === proyectoId || p.proyecto_b === proyectoId)
    .map((p) => {
      const soyA = p.proyecto_a === proyectoId;
      return {
        id: soyA ? p.proyecto_b : p.proyecto_a,
        nombre: soyA ? p.nombre_b : p.nombre_a,
        integrantes: soyA ? p.integrantes_b : p.integrantes_a,
        total: p.integrantes_a + p.integrantes_b,
        puntaje: p.puntaje,
      };
    })
    .slice(0, MAXIMO);
  if (otros.length === 0) return null;

  const supabase = await createClient();
  const { data: miembros, error } = await supabase
    .from("proyecto_integrantes")
    .select("proyecto_id, personas:personas_contacto(nombre, email)")
    .in("proyecto_id", otros.map((o) => o.id));
  if (error) throw error;

  return (
    <section className="grid gap-3 border-t pt-4">
      <div>
        <h3 className="font-serif text-base">Grupos con los que podrían unirse</h3>
        <p className="text-xs text-[#666]">
          Es solo una sugerencia: juntos no pasarían de 6 y, por los intereses y las carreras de cada grupo, encajarían
          bien. Si les interesa, hablen con ellos y pídanles el cambio a los profesores.
        </p>
      </div>
      <ul className="grid gap-2">
        {otros.map((o) => (
          <li key={o.id} className="grid gap-2 border bg-background px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{o.nombre}</span>
              <span className="text-[#666]">· {o.integrantes} {o.integrantes === 1 ? "integrante" : "integrantes"} · juntos serían {o.total}</span>
              <Badge variant={o.puntaje >= MUY_COMPATIBLES ? "default" : "outline"}>
                {o.puntaje >= MUY_COMPATIBLES ? "Muy compatibles" : "Compatibles"}
              </Badge>
            </div>
            <p className="text-xs text-[#666]">
              {(miembros ?? [])
                .filter((m) => m.proyecto_id === o.id)
                .map((m) => (m.personas.email ? `${m.personas.nombre} (${m.personas.email})` : m.personas.nombre))
                .join(" · ")}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
