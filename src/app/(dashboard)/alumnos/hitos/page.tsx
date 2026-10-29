// GRUPO ALUMNOS — "Próximos hitos": los eventos oficiales del cuatrimestre con cuenta regresiva.
// Lee la tabla eventos del core (solo lectura). Las fechas de entrega se suman cuando existan.
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";

const ZONA = "America/Argentina/Buenos_Aires";

// Día calendario en Argentina (AAAA-MM-DD), para contar días sin errores de huso horario.
const dia = (fecha: Date) => fecha.toLocaleDateString("en-CA", { timeZone: ZONA });
const diasEntre = (desde: Date, hasta: Date) =>
  Math.round((Date.parse(dia(hasta)) - Date.parse(dia(desde))) / 86_400_000);

const cuandoFalta = (dias: number) =>
  dias === 0 ? "Hoy" : dias === 1 ? "Mañana" : dias < 0 ? `Hace ${-dias} ${dias === -1 ? "día" : "días"}` : `En ${dias} días`;

const conMayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

const fechaLarga = (iso: string) =>
  conMayuscula(new Date(iso).toLocaleString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ZONA,
  }));

export default async function ProximosHitos() {
  await requireRol("alumno");
  const supabase = await createClient();
  const { data: eventos, error } = await supabase
    .from("eventos")
    .select("id, nombre, tipo, inicio, fin, lugar")
    .order("inicio");
  if (error) throw error;

  const ahora = new Date();
  const conDias = eventos.map((e) => ({ ...e, dias: diasEntre(ahora, new Date(e.inicio)) }));
  const proximos = conDias.filter((e) => e.dias >= 0);
  const pasados = conDias.filter((e) => e.dias < 0).reverse();
  const [siguiente, ...despues] = proximos;

  const detalle = (e: (typeof conDias)[number]) => (
    <p className="text-sm text-[#666]">
      {fechaLarga(e.inicio)}
      {e.lugar && <> · {e.lugar}</>}
    </p>
  );

  return (
    <>
      <h1 className="mb-2 font-serif text-2xl">Próximos hitos</h1>
      <p className="mb-8 max-w-2xl text-sm text-[#666]">
        Los eventos del cuatrimestre, del más cercano al más lejano. Pronto se van a sumar las fechas de entrega.
      </p>

      {!siguiente ? (
        <div className="mb-10 border bg-card p-8 text-sm text-[#666]">No hay eventos próximos cargados por ahora.</div>
      ) : (
        <section className="mb-10 grid max-w-3xl gap-3 border bg-card p-8">
          <p className="text-sm text-[#666]">Lo próximo</p>
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="font-serif text-3xl">{siguiente.nombre}</h2>
            <p className="font-serif text-3xl">{cuandoFalta(siguiente.dias)}</p>
          </div>
          {detalle(siguiente)}
          <div><Badge variant="outline">{siguiente.tipo}</Badge></div>
        </section>
      )}

      {despues.length > 0 && (
        <section className="mb-10 max-w-3xl">
          <h2 className="mb-3 font-serif text-lg">Después</h2>
          <ol className="divide-y border">
            {despues.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-4 bg-background px-5 py-4">
                <div className="grid gap-1">
                  <p className="font-medium">{e.nombre}</p>
                  {detalle(e)}
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{e.tipo}</Badge>
                  <span className="w-24 text-right font-serif text-lg">{cuandoFalta(e.dias)}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {pasados.length > 0 && (
        <details className="max-w-3xl">
          <summary className="cursor-pointer text-sm text-[#666] hover:text-primary">Eventos pasados ({pasados.length})</summary>
          <ol className="mt-3 divide-y border">
            {pasados.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-4 bg-background px-5 py-3 text-[#666]">
                <div className="grid gap-1">
                  <p>{e.nombre}</p>
                  {detalle(e)}
                </div>
                <span className="text-sm">{cuandoFalta(e.dias)}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </>
  );
}
