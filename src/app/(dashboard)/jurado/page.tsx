// GRUPO JURADO — esta carpeta es de ustedes.
// Planilla: cada jurado ve, en el evento elegido, solo los equipos de su salón. El admin ve todos los equipos del evento.
import Link from "next/link";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { estadosEvaluables, promedio } from "./_lib";
import { conEvento, elegirEvento, eventosVisibles, salonDelJurado } from "./_eventos";
import { fechaHora } from "./comunicaciones/plantillas";

const linkClase = "text-sm text-[#666] underline underline-offset-4 hover:text-primary";

export default async function Jurado({ searchParams }: PageProps<"/jurado">) {
  const persona = await requireRol("jurado");
  const esJurado = persona.rol === "jurado";
  const supabase = await createClient();
  const eventos = await eventosVisibles(supabase, persona);
  const evento = elegirEvento(eventos, (await searchParams).evento);

  // Equipos a mostrar: los del salón del jurado, o todos los asignados en el evento (admin).
  const salon = evento && esJurado ? await salonDelJurado(supabase, evento.id, persona.id) : null;
  const { data: asignados, error: errorAsignados } = evento
    ? await supabase.from("jurado_salon_proyectos").select("proyecto_id, jurado_salones(nombre)").eq("evento_id", evento.id)
    : { data: [], error: null };
  if (errorAsignados) throw errorAsignados;
  const salonDe = new Map(asignados.map((a) => [a.proyecto_id, a.jurado_salones.nombre]));
  const ids = esJurado ? (salon?.proyectos ?? []) : [...salonDe.keys()];

  const [proyectos, evaluaciones] = await Promise.all([
    supabase.from("proyectos").select("id, nombre, descripcion, estado, jurado_fichas(proyecto_id)").in("id", ids).in("estado", estadosEvaluables).order("nombre"),
    supabase.from("jurado_evaluaciones").select("proyecto_id, evento_id, jurado_puntajes(puntaje)").eq("jurado_id", persona.id).in("proyecto_id", ids),
  ]);
  if (proyectos.error) throw proyectos.error;
  if (evaluaciones.error) throw evaluaciones.error;

  const deEsteEvento = evaluaciones.data.filter((e) => e.evento_id === evento?.id);
  const deOtroEvento = new Set(evaluaciones.data.filter((e) => e.evento_id !== evento?.id).map((e) => e.proyecto_id));
  const promedios = new Map(deEsteEvento.map((e) => [e.proyecto_id, promedio(e.jurado_puntajes.map((p) => p.puntaje)) ?? 0]));
  const evaluados = proyectos.data.filter((p) => promedios.has(p.id)).length;
  const evaluar = (proyectoId: string) => conEvento(`/jurado/evaluar/${proyectoId}`, evento?.id);

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl">{esJurado ? "Evaluar proyectos" : "Proyectos a evaluar"}</h1>
          <p className="mt-1 text-sm text-[#666]">
            {esJurado
              ? "Puntuá cada criterio de 1 a 10. Podés volver y ajustar tus notas hasta que se publiquen las devoluciones."
              : "Como administrador podés ver las planillas, pero las notas las cargan solo los jurados."}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-end gap-6">
          <Link href={conEvento("/jurado/deliberacion", evento?.id)} className={linkClase}>Tablero de deliberación</Link>
          {!esJurado && <Link href={conEvento("/jurado/salones", evento?.id)} className={linkClase}>Salones</Link>}
          {!esJurado && <Link href={conEvento("/jurado/devoluciones", evento?.id)} className={linkClase}>Devoluciones</Link>}
          {!esJurado && <Link href="/jurado/comunicaciones" className={linkClase}>Mails a jurados</Link>}
          {esJurado && salon && (
            <p className="text-right">
              <span className="font-serif text-3xl">{evaluados}/{proyectos.data.length}</span>
              <span className="block text-xs text-[#666]">evaluados</span>
            </p>
          )}
        </div>
      </div>

      {eventos.length > 1 && evento && (
        <form className="mb-8 flex flex-wrap items-end gap-3">
          <div className="grid gap-2">
            <Label htmlFor="evento">Evento</Label>
            <select id="evento" name="evento" defaultValue={evento.id} className="h-9 min-w-64 border bg-background px-2 text-sm">
              {eventos.map((e) => <option key={e.id} value={e.id}>{e.nombre} · {fechaHora(e.inicio)}</option>)}
            </select>
          </div>
          <Button type="submit" variant="outline" size="lg">Ver</Button>
        </form>
      )}

      {!evento ? (
        <div className="border p-10 text-center text-sm text-[#666]">
          {esJurado ? "Todavía no te asignaron a un salón. Lo hace el organizador desde Salones." : "No hay eventos cargados. Los eventos los carga el grupo Austral."}
        </div>
      ) : (
        <>
          <p className="mb-6 text-sm">
            <span className="font-medium">{evento.nombre}</span>
            <span className="text-[#666]"> · {esJurado ? (salon ? salon.nombre : "sin salón asignado") : `${salonDe.size} equipos en salones`}</span>
          </p>
          {proyectos.data.length === 0 ? (
            <div className="border p-10 text-center text-sm text-[#666]">
              {esJurado ? "Tu salón todavía no tiene equipos asignados." : "Este evento todavía no tiene equipos en salones. Se asignan desde Salones."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proyecto</TableHead>
                  <TableHead className="hidden sm:table-cell">{esJurado ? "Estado" : "Salón"}</TableHead>
                  <TableHead>Ficha</TableHead>
                  <TableHead className="text-right">{esJurado ? "Tu promedio" : ""}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proyectos.data.map((p) => {
                  const tuPromedio = promedios.get(p.id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-normal">
                        <Link href={evaluar(p.id)} className="block py-2 hover:text-primary">
                          <span className="font-medium">{p.nombre}</span>
                          {p.descripcion && <span className="hidden text-[#666] sm:block">{p.descripcion}</span>}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {esJurado ? <Badge variant="outline" className="capitalize">{p.estado}</Badge> : <span className="text-sm">{salonDe.get(p.id)}</span>}
                      </TableCell>
                      <TableCell>
                        {p.jurado_fichas
                          ? <Link href={`/jurado/fichas/${p.id}`} className="text-sm underline underline-offset-4 hover:text-primary">Ver ficha</Link>
                          : !esJurado
                            ? <Link href={`/jurado/fichas/${p.id}/editar`} className={linkClase}>Cargar ficha</Link>
                            : <span className="text-sm text-[#666]">Sin ficha</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={evaluar(p.id)} className="hover:text-primary">
                          {!esJurado
                            ? <span className="text-sm text-[#666] underline underline-offset-4">Ver planilla</span>
                            : tuPromedio !== undefined
                            ? <span className="font-serif text-xl">{tuPromedio.toFixed(1)}</span>
                            : deOtroEvento.has(p.id)
                            ? <span className="text-sm text-[#666]">Evaluado en otro evento</span>
                            : <span className="text-sm text-[#666] underline underline-offset-4">Evaluar</span>}
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </>
  );
}
