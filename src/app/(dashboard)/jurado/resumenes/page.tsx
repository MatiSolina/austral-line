// GRUPO JURADO — "Resúmenes del pitch": panel del admin. Por cada equipo del evento se sube la presentación final y
// la transcripción de la sesión grabada; el agente arma el resumen y el admin lo revisa y lo aprueba para los jurados.
import Link from "next/link";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BotonConfirmar } from "../_components/boton-confirmar";
import { BotonEnviar } from "../_components/boton-enviar";
import { conEvento, elegirEvento } from "../_eventos";
import { fechaHora } from "../comunicaciones/plantillas";
import { desactualizado, duracion, estados, limiteEntrega, MENSAJE_REGENERAR, MINUTOS_POR_SALON, PALABRAS_POR_MINUTO, tamano, tipos, yaPaso } from "../_resumenes";
import { generar } from "./acciones";
import { cargarEvento, type Equipo } from "./datos";
import { Subir } from "./subir";

export default async function Resumenes({ searchParams }: PageProps<"/jurado/resumenes">) {
  await requireRol(); // solo admin
  const { evento: eventoParam, ok, error } = await searchParams;
  const supabase = await createClient();
  const { data: eventos, error: errorEventos } = await supabase.from("eventos").select("id, nombre, inicio").order("inicio");
  if (errorEventos) throw errorEventos;
  const elegido = elegirEvento(eventos, eventoParam);
  const datos = elegido ? await cargarEvento(supabase, elegido.id) : null;

  const equipos = datos?.equipos ?? [];
  const aprobados = equipos.filter((q) => q.resumen?.estado === "aprobado").length;
  const limite = datos ? limiteEntrega(datos.evento.inicio) : null;
  const vencido = !!limite && yaPaso(limite);
  const volver = conEvento("/jurado/resumenes", datos?.evento.id);

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={conEvento("/jurado", elegido?.id)} className="text-sm text-[#666] hover:text-primary">← Proyectos</Link>
      <h1 className="mt-6 font-serif text-2xl">Resúmenes del pitch</h1>
      <p className="mt-1 mb-8 max-w-3xl text-sm text-[#666]">
        Subí la presentación final y la transcripción de la sesión grabada de cada equipo. El agente arma un resumen para leer o
        escuchar (todo el salón en menos de {MINUTOS_POR_SALON} minutos), sin evaluar ni puntuar. Los jurados lo ven recién cuando lo aprobás.
      </p>

      {typeof ok === "string" && <p className="mb-6 border-l-2 border-primary pl-4 text-sm">{ok}</p>}
      {typeof error === "string" && <p role="alert" className="mb-6 border-l-2 border-destructive pl-4 text-sm text-destructive">{error}</p>}

      <form className="mb-10 flex flex-wrap items-end gap-3">
        <div className="grid gap-2">
          <Label htmlFor="evento">Evento</Label>
          <select id="evento" name="evento" defaultValue={elegido?.id} className="h-9 min-w-64 border bg-background px-2 text-sm">
            {eventos.map((e) => <option key={e.id} value={e.id}>{e.nombre} · {fechaHora(e.inicio)}</option>)}
          </select>
        </div>
        <Button type="submit" variant="outline" size="lg">Ver</Button>
      </form>

      {!datos ? (
        <div className="border p-10 text-center text-sm text-[#666]">No hay eventos cargados. Los eventos los carga el grupo Austral.</div>
      ) : equipos.length === 0 ? (
        <div className="border p-10 text-center text-sm text-[#666]">
          Este evento todavía no tiene equipos en salones. Se asignan desde <Link href={conEvento("/jurado/salones", datos.evento.id)} className="underline underline-offset-4">Salones</Link>.
        </div>
      ) : (
        <>
          {/* Meta de entrega */}
          <section className="mb-12 border bg-card p-6">
            <p>
              <span className="font-serif text-3xl">{aprobados}/{equipos.length}</span>
              <span className="ml-2 text-sm text-[#666]">resúmenes aprobados para los jurados</span>
            </p>
            <p className={`mt-1 text-sm ${vencido && aprobados < equipos.length ? "text-destructive" : "text-[#666]"}`}>
              Meta: todos aprobados antes del {fechaHora(limite!)}
              {aprobados === equipos.length ? " · cumplida." : vencido ? " · vencida: los jurados ya tendrían que tenerlos." : "."}
            </p>
          </section>

          <section className="mb-12 grid gap-12">
            {datos.salones.map((s) => {
              const delSalon = equipos.filter((q) => q.salon.id === s.id);
              if (delSalon.length === 0) return null;
              const palabras = delSalon.reduce((total, q) => total + q.palabras, 0);
              const pasado = palabras > MINUTOS_POR_SALON * PALABRAS_POR_MINUTO;
              return (
                <div key={s.id}>
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-serif text-xl">{s.nombre}</h2>
                    <p className={`text-sm ${pasado ? "text-destructive" : "text-[#666]"}`}>
                      {palabras ? `${duracion(palabras)} de escucha` : "Sin resúmenes"} · máximo {MINUTOS_POR_SALON} min
                    </p>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Equipo</TableHead>
                        <TableHead>{tipos.presentacion.titulo}</TableHead>
                        <TableHead>Transcripción</TableHead>
                        <TableHead>Resumen</TableHead>
                        <TableHead className="text-right">{""}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {delSalon.map((q) => (
                        <TableRow key={q.id} className="align-top">
                          <TableCell className="whitespace-normal font-medium">{q.nombre}</TableCell>
                          <TableCell className="whitespace-normal"><CeldaArchivo equipo={q} tipo="presentacion" eventoId={datos.evento.id} /></TableCell>
                          <TableCell className="whitespace-normal"><CeldaArchivo equipo={q} tipo="transcripcion" eventoId={datos.evento.id} /></TableCell>
                          <TableCell className="whitespace-normal text-sm">
                            {q.resumen ? (
                              <>
                                <Badge variant={estados[q.resumen.estado].variante}>{estados[q.resumen.estado].texto}</Badge>
                                {q.palabras > 0 && <span className="mt-1 block text-[#666]">{duracion(q.palabras)} · tope {duracion(q.maximo)}</span>}
                                {desactualizado(q.resumen, q.archivos.map((a) => a.id)) && (
                                  <span className="mt-1 block text-[#666]">Cambió el material: conviene regenerarlo.</span>
                                )}
                              </>
                            ) : (
                              <span className="text-[#666]">Sin generar</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end gap-1">
                              <form action={generar}>
                                <input type="hidden" name="evento_id" value={datos.evento.id} />
                                <input type="hidden" name="proyecto_id" value={q.id} />
                                <input type="hidden" name="volver" value={volver} />
                                {q.resumen?.texto ? (
                                  <BotonConfirmar mensaje={MENSAJE_REGENERAR} enviando="Generando…" className="text-[#666] hover:text-primary">Regenerar</BotonConfirmar>
                                ) : (
                                  <BotonEnviar variant={q.resumen ? "ghost" : "outline"} enviando="Generando…">{q.resumen ? "Regenerar" : "Generar"}</BotonEnviar>
                                )}
                              </form>
                              {q.resumen && (
                                <Link href={`/jurado/resumenes/${q.id}?evento=${datos.evento.id}`} className="text-sm underline underline-offset-4 hover:text-primary">
                                  Revisar
                                </Link>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}

function CeldaArchivo({ equipo, tipo, eventoId }: { equipo: Equipo; tipo: "presentacion" | "transcripcion"; eventoId: string }) {
  const archivo = equipo[tipo];
  return (
    <div className="text-sm">
      {archivo && (
        <span className="mb-1 block">
          {archivo.nombre}
          <span className="block text-xs text-[#666]">{tamano(archivo.bytes)}</span>
        </span>
      )}
      <Subir eventoId={eventoId} proyectoId={equipo.id} tipo={tipo} reemplaza={!!archivo} />
    </div>
  );
}
