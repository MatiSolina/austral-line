// GRUPO AUSTRAL — revisión del material de un proyecto (solo admin): leer el aviso del agente, chequear contra los
// documentos originales, corregir el texto y aprobarlo para que lo vean los jurados de su salón.
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { BotonConfirmar } from "../../_components/boton-confirmar";
import { BotonEnviar } from "../../_components/boton-enviar";
import { Escuchar } from "../../_components/escuchar";
import { BUCKET, desactualizado, estados, fechaHora, tamano } from "../../_preparacion";
import { despublicar, generar, guardar } from "../acciones";

const areaClase = "mt-1 w-full border bg-background p-3 text-sm leading-relaxed";

export default async function Revisar({ params, searchParams }: PageProps<"/austral/preparacion/[proyectoId]">) {
  await requireRol(); // solo admin
  const { proyectoId } = await params;
  const { evento, ok, error } = await searchParams;
  const supabase = await createClient();

  const [proyecto, material, documentos] = await Promise.all([
    supabase.from("proyectos").select("nombre, proyecto_integrantes(personas(nombre))").eq("id", proyectoId).maybeSingle(),
    supabase.from("austral_materiales").select("*").eq("proyecto_id", proyectoId).maybeSingle(),
    supabase.from("austral_documentos").select("id, nombre, ruta, bytes, created_at").eq("proyecto_id", proyectoId).order("created_at", { ascending: false }),
  ]);
  for (const r of [proyecto, material, documentos]) if (r.error) throw r.error;
  if (!proyecto.data) notFound();
  const m = material.data;
  const docs = documentos.data!;
  const { data: links } = docs.length
    ? await supabase.storage.from(BUCKET).createSignedUrls(docs.map((d) => d.ruta), 60 * 60)
    : { data: [] };

  const panel = `/austral/preparacion${typeof evento === "string" ? `?evento=${evento}` : ""}`;
  const volver = `/austral/preparacion/${proyectoId}${typeof evento === "string" ? `?evento=${evento}` : ""}`;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={panel} className="text-sm text-[#666] hover:text-primary">← Preparación de jurados</Link>
      <div className="mt-6 flex items-center gap-3">
        <h1 className="font-serif text-2xl">{proyecto.data.nombre}</h1>
        {m && <Badge variant={estados[m.estado].variante}>{estados[m.estado].texto}</Badge>}
      </div>
      <p className="mt-1 mb-8 text-sm text-[#666]">
        Equipo: {proyecto.data.proyecto_integrantes.map((i) => i.personas.nombre).join(", ") || "sin integrantes cargados"}
        {m?.generado_at && ` · generado ${fechaHora(m.generado_at)}`}
        {m?.aprobado_at && ` · aprobado ${fechaHora(m.aprobado_at)}`}
      </p>

      {ok && <p className="mb-6 border p-3 text-sm">{ok}</p>}
      {error && <p className="mb-6 border border-destructive p-3 text-sm text-destructive">{error}</p>}
      {m?.aviso && (
        <div className="mb-6 border border-destructive p-4 text-sm">
          <div className="mb-1 font-medium text-destructive">Aviso del agente</div>
          <p className="whitespace-pre-line">{m.aviso}</p>
        </div>
      )}
      {desactualizado(m, docs.map((d) => d.id)) && (
        <p className="mb-6 border p-3 text-sm">El equipo cambió sus documentos después de generar este material. Conviene regenerarlo.</p>
      )}

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-medium">Documentos del equipo</h2>
        {docs.length === 0 ? (
          <p className="text-sm text-[#666]">El equipo todavía no subió documentos.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {docs.map((d, i) => (
              <li key={d.id}>
                <a href={links?.[i]?.signedUrl ?? "#"} target="_blank" rel="noreferrer" className="underline underline-offset-4">{d.nombre}</a>
                <span className="text-[#666]"> · {fechaHora(d.created_at)} · {tamano(d.bytes)}{m?.fuentes.includes(d.nombre) ? " · usado" : ""}</span>
              </li>
            ))}
          </ul>
        )}
        <form action={generar} className="mt-4">
          <input type="hidden" name="proyecto_id" value={proyectoId} />
          <input type="hidden" name="volver" value={volver} />
          <BotonEnviar variant="outline" enviando="Generando…">{m ? "Regenerar con IA" : "Generar con IA"}</BotonEnviar>
          {m?.estado === "aprobado" && <span className="ml-3 text-sm text-[#666]">Regenerar lo saca de los jurados hasta que lo vuelvas a aprobar.</span>}
        </form>
      </section>

      {m && (
        <form action={guardar} className="space-y-5">
          <input type="hidden" name="material_id" value={m.id} />
          <input type="hidden" name="volver" value={volver} />
          <div>
            <Label htmlFor="sector">Sector o ámbito</Label>
            <input id="sector" name="sector" defaultValue={m.sector ?? ""} className={`${areaClase} h-10`} />
          </div>
          <div>
            <Label htmlFor="contexto">Contexto</Label>
            <textarea id="contexto" name="contexto" rows={4} defaultValue={m.contexto ?? ""} className={areaClase} />
          </div>
          <div>
            <Label htmlFor="problematica">Problemática central</Label>
            <textarea id="problematica" name="problematica" rows={6} defaultValue={m.problematica ?? ""} className={areaClase} />
          </div>
          <div>
            <div className="flex items-end justify-between gap-4">
              <Label htmlFor="guion">Guion de la cápsula de audio</Label>
              {m.guion && <Escuchar texto={m.guion} />}
            </div>
            <textarea id="guion" name="guion" rows={10} defaultValue={m.guion ?? ""} className={areaClase} />
            <p className="mt-1 text-xs text-[#666]">El botón Escuchar lee el último guion guardado.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t pt-5">
            <BotonEnviar variant="outline" enviando="Guardando…">Guardar cambios</BotonEnviar>
            <BotonEnviar name="accion" value="aprobar" enviando="Aprobando…">
              {m.estado === "aprobado" ? "Guardar y mantener aprobado" : "Aprobar para los jurados"}
            </BotonEnviar>
          </div>
          <p className="text-xs text-[#666]">
            Antes de aprobar chequeá que no se adelante la solución del equipo y que todo lo que dice esté en sus documentos.
          </p>
        </form>
      )}
      {m?.estado === "aprobado" && (
        <form action={despublicar} className="mt-4">
          <input type="hidden" name="material_id" value={m.id} />
          <input type="hidden" name="volver" value={volver} />
          <BotonConfirmar mensaje="Los jurados dejan de ver este material hasta que lo vuelvas a aprobar. ¿Seguimos?">Sacar de los jurados</BotonConfirmar>
        </form>
      )}
    </div>
  );
}
