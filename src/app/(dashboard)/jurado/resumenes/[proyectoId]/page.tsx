// GRUPO JURADO — revisión del resumen del pitch de un equipo (solo admin): leer el reporte del agente, chequear contra
// el material original, corregir el texto y aprobarlo para que lo vean los jurados de su salón.
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { BotonConfirmar } from "../../_components/boton-confirmar";
import { BotonEnviar } from "../../_components/boton-enviar";
import { Escuchar } from "../../_components/escuchar";
import { conEvento } from "../../_eventos";
import { fechaHora } from "../../comunicaciones/plantillas";
import { BUCKET, desactualizado, duracion, estados, tamano, tipos } from "../../_resumenes";
import { despublicar, generar, guardar } from "../acciones";
import { cargarEvento } from "../datos";

export default async function Revisar({ params, searchParams }: PageProps<"/jurado/resumenes/[proyectoId]">) {
  await requireRol(); // solo admin
  const { proyectoId } = await params;
  const { evento, ok, error } = await searchParams;
  if (typeof evento !== "string") notFound();
  const supabase = await createClient();

  const datos = await cargarEvento(supabase, evento);
  const equipo = datos?.equipos.find((q) => q.id === proyectoId);
  if (!datos || !equipo) notFound();
  const r = equipo.resumen;
  const { data: links } = equipo.archivos.length
    ? await supabase.storage.from(BUCKET).createSignedUrls(equipo.archivos.map((a) => a.ruta), 60 * 60)
    : { data: [] };

  const panel = conEvento("/jurado/resumenes", evento);
  const volver = `/jurado/resumenes/${proyectoId}?evento=${evento}`;
  const ocultos = (
    <>
      <input type="hidden" name="evento_id" value={evento} />
      <input type="hidden" name="proyecto_id" value={proyectoId} />
      <input type="hidden" name="volver" value={volver} />
    </>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={panel} className="text-sm text-[#666] hover:text-primary">← Resúmenes del pitch</Link>
      <div className="mt-6 flex items-center gap-3">
        <h1 className="font-serif text-2xl">{equipo.nombre}</h1>
        {r && <Badge variant={estados[r.estado].variante}>{estados[r.estado].texto}</Badge>}
      </div>
      <p className="mt-1 mb-8 text-sm text-[#666]">
        {datos.evento.nombre} · {equipo.salon.nombre}
        {r?.generado_at && ` · generado ${fechaHora(r.generado_at)}`}
        {r?.aprobado_at && ` · aprobado ${fechaHora(r.aprobado_at)}`}
      </p>

      {typeof ok === "string" && <p className="mb-6 border-l-2 border-primary pl-4 text-sm">{ok}</p>}
      {typeof error === "string" && <p role="alert" className="mb-6 border-l-2 border-destructive pl-4 text-sm text-destructive">{error}</p>}
      {r?.aviso && (
        <div className="mb-6 border border-destructive p-4 text-sm">
          <div className="mb-1 font-medium text-destructive">Reporte del agente</div>
          <p className="whitespace-pre-line">{r.aviso}</p>
        </div>
      )}
      {desactualizado(r, equipo.archivos.map((a) => a.id)) && (
        <p className="mb-6 border-l-2 pl-4 text-sm">Cambió el material después de generar este resumen. Conviene regenerarlo.</p>
      )}

      <section className="mb-10">
        <h2 className="mb-2 text-sm font-medium">Material del equipo</h2>
        <ul className="space-y-1 text-sm">
          {(["presentacion", "transcripcion"] as const).map((tipo) => {
            const a = equipo[tipo];
            const i = a ? equipo.archivos.indexOf(a) : -1;
            return (
              <li key={tipo}>
                <span className="text-[#666]">{tipos[tipo].titulo}: </span>
                {a ? (
                  <>
                    <a href={links?.[i]?.signedUrl ?? "#"} target="_blank" rel="noreferrer" className="underline underline-offset-4">{a.nombre}</a>
                    <span className="text-[#666]"> · {fechaHora(a.created_at)} · {tamano(a.bytes)}</span>
                  </>
                ) : (
                  <span className="text-destructive">falta</span>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-[#666]">Para cambiar el material, subilo de nuevo desde el panel.</p>
        <form action={generar} className="mt-4">
          {ocultos}
          <BotonEnviar variant="outline" enviando="Generando…">{r?.texto ? "Regenerar con IA" : "Generar con IA"}</BotonEnviar>
          {r?.estado === "aprobado" && <span className="ml-3 text-sm text-[#666]">Regenerar lo saca de los jurados hasta que lo vuelvas a aprobar.</span>}
        </form>
      </section>

      {r && (
        <form action={guardar} className="space-y-5">
          {ocultos}
          <div>
            <div className="flex items-end justify-between gap-4">
              <Label htmlFor="texto">Resumen para los jurados</Label>
              {r.texto && <Escuchar texto={r.texto} />}
            </div>
            <textarea id="texto" name="texto" rows={14} defaultValue={r.texto ?? ""} className="mt-1 w-full border bg-background p-3 text-sm leading-relaxed" />
            <p className="mt-1 text-xs text-[#666]">
              {duracion(equipo.palabras)} leído en voz alta · tope para este salón: {duracion(equipo.maximo)} por equipo. El botón Escuchar lee el último texto guardado.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t pt-5">
            <BotonEnviar variant="outline" enviando="Guardando…">Guardar cambios</BotonEnviar>
            <BotonEnviar name="accion" value="aprobar" enviando="Aprobando…">
              {r.estado === "aprobado" ? "Guardar y mantener aprobado" : "Aprobar para los jurados"}
            </BotonEnviar>
          </div>
          <p className="text-xs text-[#666]">
            Antes de aprobar chequeá que no evalúe ni valore el proyecto y que todo lo que dice esté en la presentación o en la sesión.
          </p>
        </form>
      )}
      {r?.estado === "aprobado" && (
        <form action={despublicar} className="mt-4">
          {ocultos}
          <BotonConfirmar mensaje="Los jurados dejan de ver este resumen hasta que lo vuelvas a aprobar. ¿Seguimos?">Sacar de los jurados</BotonConfirmar>
        </form>
      )}
    </div>
  );
}
