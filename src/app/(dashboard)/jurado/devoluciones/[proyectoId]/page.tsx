// GRUPO JURADO — revisión privada de la devolución de un equipo. Solo el admin/organizador.
// Las notas las calcula el sistema; el admin solo edita los textos. Después de publicar, corregir pide motivo.
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { fechaHora } from "../../comunicaciones/plantillas";
import { guardarDevolucion } from "../acciones";
import { armarTextos, cargarEvento, estados } from "../datos";

const formato = (n: number | null | undefined) => (n == null ? "—" : Number(n).toFixed(1));
const areaClase = "w-full border bg-transparent p-3 text-sm outline-none focus-visible:border-ring";

export default async function RevisarDevolucion({ params, searchParams }: PageProps<"/jurado/devoluciones/[proyectoId]">) {
  await requireRol(); // solo admin
  const { proyectoId } = await params;
  const { evento: eventoId, ok, error } = await searchParams;
  if (typeof eventoId !== "string") notFound();
  const supabase = await createClient();
  const datos = await cargarEvento(supabase, eventoId);
  const equipo = datos?.equipos.find((q) => q.id === proyectoId);
  if (!datos || !equipo) notFound();

  const publicado = !!datos.publicacion;
  const { devolucion } = equipo;
  const { data: historial, error: errorHistorial } = await supabase
    .from("jurado_devoluciones_historial")
    .select("id, motivo, cambiado_at, comentarios, propuestas, personas(nombre)")
    .eq("evento_id", eventoId).eq("proyecto_id", proyectoId)
    .order("cambiado_at", { ascending: false });
  if (errorHistorial) throw errorHistorial;

  // Los textos que el admin ya editó se conservan siempre. Si un jurado cambió o agregó algo, aparece marcado como nuevo.
  const vigente = devolucion && equipo.estado === "lista";
  const hayRevision = !!devolucion;
  const comentarios = armarTextos(equipo.comentariosOriginales, equipo.vistos?.comentarios ?? [], devolucion?.comentarios ?? [], hayRevision);
  const propuestas = armarTextos(equipo.propuestasOriginales, equipo.vistos?.propuestas ?? [], devolucion?.propuestas ?? [], hayRevision);
  const hayNuevos = [...comentarios.items, ...propuestas.items].some((t) => t.nuevo);
  const reemplazados = [...propuestas.reemplazados, ...comentarios.reemplazados];
  const volver = `/jurado/devoluciones?evento=${eventoId}`;

  const bloque = (titulo: string, campo: "comentario" | "propuesta", items: { texto: string; original: string; nuevo: boolean }[], vacio: string) => (
    <fieldset className="mb-10 grid gap-5">
      <legend className="mb-1 font-serif text-xl">{titulo}</legend>
      {items.length === 0 ? (
        <p className="text-sm text-[#666]">{vacio}</p>
      ) : items.map(({ texto, original, nuevo }, i) => (
        <div key={`${campo}-${i}`} className={nuevo ? "grid gap-2 border border-destructive p-3" : "grid gap-2"}>
          <Label htmlFor={`${campo}-${i}`} className="text-xs text-[#666]">
            {campo === "comentario" ? `Comentario ${i + 1}` : `Propuesta ${i + 1}`}
            {nuevo ? <span className="text-destructive"> · nuevo o modificado por un jurado: revisalo</span> : texto !== original && " · editado"}
          </Label>
          <textarea id={`${campo}-${i}`} name={campo} rows={3} defaultValue={texto} className={areaClase} />
          <input type="hidden" name={`${campo}_original`} value={original} />
          {!nuevo && texto !== original && <p className="text-xs text-[#666]">Original: {original}</p>}
        </div>
      ))}
    </fieldset>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={volver} className="text-sm text-[#666] hover:text-primary">← Devoluciones de {datos.evento.nombre}</Link>
      <header className="mt-6 mb-8 border-b pb-6">
        <p className="text-sm text-[#666]">{datos.evento.nombre} · {equipo.salon.nombre}</p>
        <h1 className="mt-1 font-serif text-3xl">{equipo.nombre}</h1>
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <Badge variant={estados[equipo.estado].bloquea ? "destructive" : "outline"}>{estados[equipo.estado].texto}</Badge>
          {devolucion?.revisada_at && <span className="text-[#666]">Última revisión: {fechaHora(devolucion.revisada_at)}</span>}
          {devolucion?.actualizada_at && <span className="text-[#666]">· Actualizada para el equipo: {fechaHora(devolucion.actualizada_at)}</span>}
        </p>
      </header>

      {typeof ok === "string" && <p className="mb-6 border-l-2 border-primary pl-4 text-sm">{ok}</p>}
      {typeof error === "string" && <p role="alert" className="mb-6 border-l-2 border-destructive pl-4 text-sm text-destructive">{error}</p>}

      {equipo.estado === "desactualizada" && (
        <div role="alert" className="mb-8 border border-destructive p-4 text-sm">
          <p className="font-medium text-destructive">Las evaluaciones cambiaron desde tu última revisión.</p>
          <p className="mt-1 text-[#666]">
            Tus textos editados se conservaron. {hayNuevos ? "Los que un jurado agregó o cambió están marcados en rojo: revisalos antes de guardar." : "Ningún jurado agregó ni cambió textos."} Guardá para poder publicar.
          </p>
          {reemplazados.length > 0 && (
            <p className="mt-2 text-[#666]">Versión tuya de textos que el jurado cambió o quitó (ya no se usa): {reemplazados.join(" · ")}</p>
          )}
        </div>
      )}

      {equipo.faltan.length > 0 && (
        <p className="mb-8 border-l-2 border-primary pl-4 text-sm text-[#666]">
          Todavía no completaron su evaluación: {equipo.faltan.map((j) => j.nombre).join(", ")}. Se puede publicar igual con las que hay.
        </p>
      )}

      {/* Notas: solo lectura */}
      <section className="mb-10">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="font-serif text-xl">Notas</h2>
          <span className="font-serif text-4xl">{formato(vigente ? devolucion.promedio_general : equipo.general)}</span>
        </div>
        <dl className="grid grid-cols-2 gap-px border bg-border sm:grid-cols-4">
          {equipo.porCriterio.map((c) => (
            <div key={c.criterio} className="bg-background p-4">
              <dt className="text-xs text-[#666]">{c.criterio}</dt>
              <dd className="mt-1 font-serif text-2xl">{formato(c.promedio)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-[#666]">
          Promedio de {equipo.evaluaciones.length} {equipo.evaluaciones.length === 1 ? "evaluación" : "evaluaciones"} de este evento.
          Las calcula el sistema a partir de las notas de los jurados: no se pueden editar.
        </p>
      </section>

      <form action={guardarDevolucion}>
        <input type="hidden" name="evento_id" value={eventoId} />
        <input type="hidden" name="proyecto_id" value={proyectoId} />
        <p className="mb-6 text-sm text-[#666]">
          Estos textos los ve el equipo, sin nombres. Podés editarlos o vaciar alguno para que no se muestre (por ejemplo, si identifica al jurado).
        </p>
        {bloque("Cómo entendieron su propuesta de valor", "propuesta", propuestas.items, "Ningún jurado completó la propuesta de valor.")}
        {bloque("Comentarios del jurado", "comentario", comentarios.items, "Ningún jurado dejó comentarios.")}

        {hayNuevos && (
          <label className="mb-8 flex items-start gap-3 border border-destructive p-4 text-sm">
            <input type="checkbox" name="confirmo_nuevos" required className="mt-1" />
            <span>Revisé los textos marcados: no identifican a ningún jurado.</span>
          </label>
        )}

        {publicado && (
          <div className="mb-8 grid gap-2">
            <Label htmlFor="motivo">Motivo de la corrección</Label>
            <p className="text-sm text-[#666]">Obligatorio. Queda en el historial interno; el equipo solo ve la fecha de actualización. No se manda otro mail.</p>
            <textarea id="motivo" name="motivo" rows={2} required className={areaClase} />
          </div>
        )}

        <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-background py-4">
          <Link href={volver} className="flex h-9 items-center px-3 text-sm text-[#666] hover:text-primary">Cancelar</Link>
          <Button type="submit" size="lg">{publicado ? "Guardar corrección" : "Guardar y marcar como revisada"}</Button>
        </div>
      </form>

      {historial.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-4 font-serif text-xl">Historial de correcciones</h2>
          <ol className="grid gap-4">
            {historial.map((h) => (
              <li key={h.id} className="border p-4 text-sm">
                <p className="font-medium">{h.motivo}</p>
                <p className="mt-1 text-[#666]">{fechaHora(h.cambiado_at)}{h.personas && ` · ${h.personas.nombre}`}</p>
                <details className="mt-2 text-[#666]">
                  <summary className="cursor-pointer">Versión anterior</summary>
                  <ul className="mt-2 list-disc pl-5">
                    {[...h.propuestas, ...h.comentarios].filter(Boolean).map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </details>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
