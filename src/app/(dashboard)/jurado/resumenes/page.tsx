// GRUPO JURADO — "Resúmenes del pitch": panel del admin. Por cada equipo del evento se sube la presentación final y
// la transcripción de la sesión grabada; el agente arma el resumen y el admin lo revisa y lo aprueba para los jurados.
import Link from "next/link";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BotonEnviar } from "../_components/boton-enviar";
import { conEvento, elegirEvento } from "../_eventos";
import { fechaHora } from "../comunicaciones/plantillas";
import { desactualizado, duracion, estados, limiteEntrega, MINUTOS_POR_SALON, PALABRAS_POR_MINUTO, tamano, tipos, yaPaso } from "../_resumenes";
import { BotonConfirmar } from "../_components/boton-confirmar";
import { modoPrueba } from "../_resend";
import { cancelarEntrega, generar, programarEntrega } from "./acciones";
import { cargarEvento, type Equipo } from "./datos";
import { estadosActivos } from "./envios";
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
  const sinAprobar = equipos.filter((q) => q.resumen?.estado !== "aprobado").map((q) => q.nombre);

  const { data: envios, error: errorEnvios } = datos
    ? await supabase
      .from("jurado_resumen_envios")
      .select("id, tipo, email, programado_para, estado, error, created_at, proyectos(nombre)")
      .eq("evento_id", datos.evento.id)
      .order("created_at", { ascending: false })
    : { data: [], error: null };
  if (errorEnvios) throw errorEnvios;
  const entregas = envios.filter((e) => e.tipo === "entrega" && estadosActivos().includes(e.estado));

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
          {/* Meta y entrega a los jurados */}
          <section className="mb-12 flex flex-col gap-6 border bg-card p-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p>
                <span className="font-serif text-3xl">{aprobados}/{equipos.length}</span>
                <span className="ml-2 text-sm text-[#666]">resúmenes aprobados para los jurados</span>
              </p>
              <p className={`mt-1 text-sm ${vencido && aprobados < equipos.length ? "text-destructive" : "text-[#666]"}`}>
                Meta: todos aprobados antes del {fechaHora(limite!)}
                {aprobados === equipos.length ? " · cumplida." : vencido ? " · vencida: los jurados ya tendrían que tenerlos." : "."}
              </p>
              <p className="mt-3 text-sm">
                {entregas.length === 0
                  ? "Entrega a los jurados: sin programar."
                  : `Entrega a los jurados: ${entregas.length} ${entregas.length === 1 ? "jurado" : "jurados"} · ${entregas.some((e) => e.estado === "enviado") ? "enviada" : `programada para el ${fechaHora(entregas[0].programado_para ?? limite!)}`}${modoPrueba() ? " (simulada)" : ""}.`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {entregas.some((e) => e.programado_para && !yaPaso(e.programado_para)) && (
                <form action={cancelarEntrega}>
                  <input type="hidden" name="evento_id" value={datos.evento.id} />
                  <input type="hidden" name="volver" value={volver} />
                  <BotonConfirmar mensaje="¿Cancelar la entrega programada? Sirve si cambió el horario del evento: después la volvés a programar.">Cancelar entrega</BotonConfirmar>
                </form>
              )}
              <form action={programarEntrega}>
                <input type="hidden" name="evento_id" value={datos.evento.id} />
                <input type="hidden" name="volver" value={volver} />
                <BotonConfirmar
                  variant={entregas.length ? "outline" : "default"}
                  size="lg"
                  mensaje={[
                    `Cada jurado recibe el ${vencido ? "mail ahora" : `${fechaHora(limite!)}`} un mail con el link a los resúmenes de su salón.`,
                    sinAprobar.length ? `\nOjo: todavía falta aprobar ${sinAprobar.join(", ")}. Aparecen en la pantalla del jurado cuando los apruebes.` : "",
                    entregas.length ? "\nA los jurados que ya la tienen no se les manda de nuevo." : "",
                    "\n¿Seguimos?",
                  ].join("")}
                >
                  {entregas.length ? "Sumar jurados nuevos" : "Programar entrega a los jurados"}
                </BotonConfirmar>
              </form>
            </div>
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
                                <BotonEnviar variant={q.resumen ? "ghost" : "outline"} enviando="Generando…">{q.resumen ? "Regenerar" : "Generar"}</BotonEnviar>
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

          {/* Historial: entregas a los jurados y alertas a los admins */}
          <section className="mb-12">
            <h2 className="mb-1 font-serif text-xl">Mails</h2>
            <p className="mb-3 text-sm text-[#666]">
              Entregas a los jurados y alertas a los admins cuando el agente frena.
              {modoPrueba() && " Modo prueba: falta la clave de Resend, así que quedan como \"simulado\" y no sale ninguno."}
            </p>
            {envios.length === 0 ? (
              <p className="border p-6 text-center text-sm text-[#666]">Todavía no se mandó ningún mail para este evento.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Mail</TableHead><TableHead>Para</TableHead><TableHead>Cuándo</TableHead><TableHead>Estado</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {envios.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-normal text-sm">{e.tipo === "entrega" ? "Entrega a jurado" : `Alerta: ${e.proyectos?.nombre ?? "equipo"}`}</TableCell>
                      <TableCell className="whitespace-normal break-all text-sm">{e.email}</TableCell>
                      <TableCell className="whitespace-normal text-sm text-[#666]">{fechaHora(e.programado_para ?? e.created_at)}</TableCell>
                      <TableCell className="whitespace-normal text-sm">
                        <Badge variant={e.estado === "error" ? "destructive" : "outline"}>{estadoEnvio[e.estado] ?? e.estado}</Badge>
                        {e.error && <span className="mt-1 block text-[#666]">{e.error}</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        </>
      )}
    </div>
  );
}

const estadoEnvio: Record<string, string> = { programado: "Programado", enviado: "Enviado", simulado: "Simulado", cancelado: "Cancelado", error: "Error" };

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
