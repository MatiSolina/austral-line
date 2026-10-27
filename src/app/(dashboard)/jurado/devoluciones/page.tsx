// GRUPO JURADO — devoluciones a los alumnos, por evento. Solo el admin/organizador.
// Muestra qué evaluaciones faltan y el estado de cada devolución, y publica todas juntas.
import Link from "next/link";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BotonConfirmar } from "../_components/boton-confirmar";
import { elegirEvento } from "../_eventos";
import { fechaHora } from "../comunicaciones/plantillas";
import { modoPrueba } from "../_resend";
import { marcarAusente, publicar, quitarAusente, reintentarMails } from "./acciones";
import { cargarEvento, estados } from "./datos";

const estadoEnvio: Record<string, string> = { enviado: "Enviado", simulado: "Simulado", error: "Error" };

export default async function Devoluciones({ searchParams }: PageProps<"/jurado/devoluciones">) {
  await requireRol(); // solo admin
  const { evento: eventoParam, ok, error } = await searchParams;
  const supabase = await createClient();
  const { data: eventos, error: errorEventos } = await supabase.from("eventos").select("id, nombre, inicio").order("inicio");
  if (errorEventos) throw errorEventos;
  const elegido = elegirEvento(eventos, eventoParam);
  const datos = elegido ? await cargarEvento(supabase, elegido.id) : null;

  const { data: envios, error: errorEnvios } = datos?.publicacion
    ? await supabase.from("jurado_devolucion_envios").select("proyecto_id, email, estado, error, created_at, proyectos(nombre)").eq("evento_id", datos.evento.id).order("created_at", { ascending: false })
    : { data: [], error: null };
  if (errorEnvios) throw errorEnvios;

  const equipos = datos?.equipos ?? [];
  const aPublicar = equipos.filter((q) => q.estado !== "ausente");
  const bloqueantes = equipos.filter((q) => estados[q.estado].bloquea);
  const publicado = !!datos?.publicacion;
  // Pendientes de reintento: fallaron y todavía no hay un envío bueno para esa persona y ese equipo.
  const llegaron = new Set(envios.filter((e) => e.estado !== "error").map((e) => `${e.proyecto_id}:${e.email}`));
  const mailsConError = envios.filter((e) => e.estado === "error" && !llegaron.has(`${e.proyecto_id}:${e.email}`)).length;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/jurado${elegido ? `?evento=${elegido.id}` : ""}`} className="text-sm text-[#666] hover:text-primary">← Proyectos</Link>
      <h1 className="mt-6 font-serif text-2xl">Devoluciones</h1>
      <p className="mt-1 mb-8 text-sm text-[#666]">
        Revisá en privado la devolución de cada equipo y publicalas todas juntas. Cada equipo ve solo la suya, sin nombres de jurados ni ranking.
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
          Este evento todavía no tiene equipos en salones. Se asignan desde <Link href={`/jurado/salones?evento=${datos.evento.id}`} className="underline underline-offset-4">Salones</Link>.
        </div>
      ) : (
        <>
          {/* Estado de la publicación */}
          <section className="mb-12 border bg-card p-6">
            {publicado ? (
              <>
                <p className="font-serif text-xl">Publicadas</p>
                <p className="mt-1 text-sm text-[#666]">
                  {fechaHora(datos.publicacion!.publicada_at)}{datos.publicacion!.personas && ` · por ${datos.publicacion!.personas.nombre}`}.
                  Las notas, los salones y las ausencias de este evento quedaron cerrados. Podés corregir textos con motivo.
                </p>
              </>
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p>
                    <span className="font-serif text-3xl">{aPublicar.length - bloqueantes.length}/{aPublicar.length}</span>
                    <span className="ml-2 text-sm text-[#666]">devoluciones listas para publicar</span>
                  </p>
                  <p className="mt-1 text-sm text-[#666]">
                    {bloqueantes.length > 0
                      ? `Falta resolver: ${bloqueantes.map((q) => q.nombre).join(", ")}.`
                      : "Todo listo. Al publicar, todos los equipos acceden al mismo tiempo y se cierran las notas del evento."}
                  </p>
                </div>
                <form action={publicar}>
                  <input type="hidden" name="evento_id" value={datos.evento.id} />
                  <BotonConfirmar
                    variant="default"
                    size="lg"
                    disabled={bloqueantes.length > 0 || aPublicar.length === 0}
                    mensaje={`¿Publicar las devoluciones de ${aPublicar.length} ${aPublicar.length === 1 ? "equipo" : "equipos"} de ${datos.evento.nombre}?\n\nTodos los equipos van a poder verlas al mismo tiempo, las notas del evento se cierran y no se puede despublicar. Después se manda un mail de aviso a cada integrante.`}
                  >
                    Publicar todas
                  </BotonConfirmar>
                </form>
              </div>
            )}
          </section>

          {/* Equipos por salón */}
          <section className="mb-12 grid gap-10">
            {datos.salones.map((s) => {
              const delSalon = equipos.filter((q) => q.salon.id === s.id);
              if (delSalon.length === 0) return null;
              return (
                <div key={s.id}>
                  <h2 className="mb-3 font-serif text-xl">{s.nombre}</h2>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Equipo</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="hidden sm:table-cell">Evaluaciones</TableHead>
                        <TableHead className="text-right">{""}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {delSalon.map((q) => (
                        <TableRow key={q.id}>
                          <TableCell className="whitespace-normal font-medium">{q.nombre}</TableCell>
                          <TableCell className="whitespace-normal">
                            <Badge variant={estados[q.estado].bloquea ? "destructive" : "outline"}>{estados[q.estado].texto}</Badge>
                          </TableCell>
                          <TableCell className="hidden whitespace-normal text-sm sm:table-cell">
                            {q.estado === "ausente" ? "—" : (
                              <>
                                <span>{q.jurados.length - q.faltan.length}/{q.jurados.length} completas</span>
                                {q.faltan.length > 0 && <span className="block text-[#666]">Falta: {q.faltan.map((j) => j.nombre).join(", ")}</span>}
                              </>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end gap-1">
                              {q.estado !== "ausente" && q.estado !== "sin_evaluaciones" && (
                                <Link href={`/jurado/devoluciones/${q.id}?evento=${datos.evento.id}`} className="text-sm underline underline-offset-4 hover:text-primary">
                                  {publicado ? "Ver o corregir" : "Revisar"}
                                </Link>
                              )}
                              {!publicado && q.estado === "sin_evaluaciones" && (
                                <form action={marcarAusente}>
                                  <input type="hidden" name="evento_id" value={datos.evento.id} />
                                  <input type="hidden" name="proyecto_id" value={q.id} />
                                  <BotonConfirmar mensaje={`¿Marcar a ${q.nombre} como "No se presentó"?\n\nSigue en su salón, pero no recibe devolución ni mail.`}>
                                    No se presentó
                                  </BotonConfirmar>
                                </form>
                              )}
                              {!publicado && q.estado === "ausente" && (
                                <form action={quitarAusente}>
                                  <input type="hidden" name="evento_id" value={datos.evento.id} />
                                  <input type="hidden" name="proyecto_id" value={q.id} />
                                  <Button type="submit" variant="ghost" size="sm" className="text-[#666]">Quitar marca</Button>
                                </form>
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

          {/* Mails de aviso */}
          {publicado && (
            <section className="mb-12">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <h2 className="font-serif text-xl">Mails de aviso</h2>
                {mailsConError > 0 && (
                  <form action={reintentarMails}>
                    <input type="hidden" name="evento_id" value={datos.evento.id} />
                    <Button type="submit" variant="outline" size="sm">Reintentar los que fallaron</Button>
                  </form>
                )}
              </div>
              {modoPrueba() && <p className="mb-3 text-sm text-[#666]">Modo prueba: falta la clave de Resend, así que los mails quedan como &quot;simulado&quot;.</p>}
              {envios.length === 0 ? (
                <p className="border p-6 text-center text-sm text-[#666]">No hay mails registrados.</p>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Equipo</TableHead><TableHead>Mail</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {envios.map((e, i) => (
                      <TableRow key={i}>
                        <TableCell className="whitespace-normal">{e.proyectos.nombre}</TableCell>
                        <TableCell className="whitespace-normal break-all text-sm">{e.email}</TableCell>
                        <TableCell className="whitespace-normal text-sm">
                          <Badge variant={e.estado === "error" ? "destructive" : "outline"}>{estadoEnvio[e.estado]}</Badge>
                          {e.error && <span className="mt-1 block text-[#666]">{e.error}</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
