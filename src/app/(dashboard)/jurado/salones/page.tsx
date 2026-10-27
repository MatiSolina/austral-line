// GRUPO JURADO — organización de cada evento en salones: qué equipos se presentan y qué jurados escuchan en cada uno.
// Solo el admin/organizador. Abajo muestra qué jurados todavía no completaron sus evaluaciones de este evento.
import Link from "next/link";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { estadosEvaluables } from "../_lib";
import { fechaHora } from "../comunicaciones/plantillas";
import { borrarSalon, crearSalon, guardarAsignaciones, renombrarSalon } from "./acciones";
import { BotonConfirmar } from "../_components/boton-confirmar";

const selectClase = "h-9 w-full min-w-32 border bg-background px-2 text-sm";
const cantidad = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;

export default async function Salones({ searchParams }: PageProps<"/jurado/salones">) {
  await requireRol(); // solo admin
  const { evento: eventoElegido, ok, error } = await searchParams;
  const supabase = await createClient();

  const { data: eventos, error: errorEventos } = await supabase.from("eventos").select("id, nombre, inicio").order("inicio");
  if (errorEventos) throw errorEventos;
  const ahora = new Date().toISOString();
  const evento = eventos.find((e) => e.id === eventoElegido) ?? eventos.find((e) => e.inicio > ahora) ?? eventos.at(-1);

  const encabezado = (
    <>
      <Link href="/jurado" className="text-sm text-[#666] hover:text-primary">← Proyectos</Link>
      <h1 className="mt-6 font-serif text-2xl">Salones</h1>
      <p className="mt-1 mb-8 text-sm text-[#666]">
        Armá los salones de cada evento y asigná qué equipos se presentan y qué jurados escuchan en cada uno.
        La final es un evento con un solo salón.
      </p>
    </>
  );
  if (!evento) {
    return (
      <div className="mx-auto max-w-4xl">
        {encabezado}
        <div className="border p-10 text-center text-sm text-[#666]">No hay eventos cargados. Los eventos los carga el grupo Austral.</div>
      </div>
    );
  }

  const [salones, proyectos, jurados, asignProyectos, asignJurados, criterios, evaluaciones, sinEvento, publicacion] = await Promise.all([
    supabase.from("jurado_salones").select("id, nombre").eq("evento_id", evento.id).order("orden"),
    supabase.from("proyectos").select("id, nombre, estado").in("estado", estadosEvaluables).order("nombre"),
    supabase.from("personas").select("id, nombre").eq("rol", "jurado").order("nombre"),
    supabase.from("jurado_salon_proyectos").select("salon_id, proyecto_id, proyectos(nombre, estado)").eq("evento_id", evento.id),
    supabase.from("jurado_salon_jurados").select("salon_id, jurado_id, personas(nombre, rol)").eq("evento_id", evento.id),
    supabase.from("jurado_criterios").select("id", { count: "exact", head: true }),
    supabase.from("jurado_evaluaciones").select("proyecto_id, jurado_id, jurado_puntajes(criterio_id)").eq("evento_id", evento.id),
    supabase.from("jurado_evaluaciones").select("id", { count: "exact", head: true }).is("evento_id", null),
    supabase.from("jurado_publicaciones").select("evento_id").eq("evento_id", evento.id).maybeSingle(),
  ]);
  for (const r of [salones, proyectos, jurados, asignProyectos, asignJurados, criterios, evaluaciones, sinEvento, publicacion]) if (r.error) throw r.error;
  // Con las devoluciones publicadas, los salones del evento quedan cerrados (la base también lo impide).
  const cerrado = !!publicacion.data;

  const salonDeProyecto = new Map(asignProyectos.data!.map((a) => [a.proyecto_id, a.salon_id]));
  const salonDeJurado = new Map(asignJurados.data!.map((a) => [a.jurado_id, a.salon_id]));
  const totalCriterios = criterios.count ?? 0;
  // Evaluación completa = tiene nota en todos los criterios.
  const completas = new Set(
    evaluaciones.data!
      .filter((e) => totalCriterios > 0 && e.jurado_puntajes.length >= totalCriterios)
      .map((e) => `${e.proyecto_id}:${e.jurado_id}`),
  );

  const resumen = salones.data!.map((s) => {
    const equipos = proyectos.data!.filter((p) => salonDeProyecto.get(p.id) === s.id);
    const suyos = jurados.data!.filter((j) => salonDeJurado.get(j.id) === s.id);
    const avance = suyos.map((j) => ({
      ...j,
      faltan: equipos.filter((p) => !completas.has(`${p.id}:${j.id}`)),
    }));
    return { ...s, equipos, jurados: suyos, avance };
  });
  const equiposSinSalon = proyectos.data!.filter((p) => !salonDeProyecto.has(p.id));
  const juradosSinSalon = jurados.data!.filter((j) => !salonDeJurado.has(j.id));
  const pendientes = resumen.flatMap((s) => s.avance.filter((j) => j.faltan.length > 0));
  // Asignados que ya no se pueden evaluar (el proyecto volvió a borrador o la persona dejó de ser jurado):
  // no aparecen en las listas, así que al guardar salen de su salón. Avisamos para que no pase sin darse cuenta.
  const fueraDeJuego = [
    ...asignProyectos.data!.filter((a) => !estadosEvaluables.includes(a.proyectos.estado)).map((a) => `${a.proyectos.nombre} (volvió a borrador)`),
    ...asignJurados.data!.filter((a) => a.personas.rol !== "jurado").map((a) => `${a.personas.nombre} (ya no es jurado)`),
  ];

  return (
    <div className="mx-auto max-w-4xl">
      {encabezado}

      {typeof ok === "string" && <p className="mb-6 border-l-2 border-primary pl-4 text-sm">{ok}</p>}
      {typeof error === "string" && <p className="mb-6 border-l-2 border-destructive pl-4 text-sm text-destructive">{error}</p>}

      <form className="mb-10 flex flex-wrap items-end gap-3">
        <div className="grid gap-2">
          <Label htmlFor="evento">Evento</Label>
          <select id="evento" name="evento" defaultValue={evento.id} className="h-9 min-w-64 border bg-background px-2 text-sm">
            {eventos.map((e) => <option key={e.id} value={e.id}>{e.nombre} · {fechaHora(e.inicio)}</option>)}
          </select>
        </div>
        <Button type="submit" variant="outline" size="lg">Ver</Button>
      </form>

      {cerrado && (
        <p className="mb-8 border-l-2 border-primary pl-4 text-sm text-[#666]">
          Las devoluciones de este evento ya se publicaron: los salones y las asignaciones quedaron cerrados.
        </p>
      )}

      {/* Con el evento publicado, todo lo de abajo queda deshabilitado. */}
      <fieldset disabled={cerrado} className="contents">
      {/* 1. Salones del evento */}
      <section className="mb-14">
        <h2 className="mb-1 font-serif text-xl">Salones de {evento.nombre}</h2>
        <p className="mb-6 text-sm text-[#666]">Creá uno por cada sala donde se presentan equipos en paralelo.</p>

        {resumen.length === 0 ? (
          <div className="mb-6 border p-8 text-center text-sm text-[#666]">Este evento todavía no tiene salones. Creá el primero abajo.</div>
        ) : (
          <div className="mb-6 border">
            {resumen.map((s) => (
              <div key={s.id} className="flex flex-col gap-3 border-b p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
                <form action={renombrarSalon} className="flex flex-1 items-center gap-2">
                  <input type="hidden" name="evento_id" value={evento.id} />
                  <input type="hidden" name="salon_id" value={s.id} />
                  <Input name="nombre" defaultValue={s.nombre} aria-label="Nombre del salón" className="max-w-56" required />
                  <Button type="submit" variant="outline" size="sm">Renombrar</Button>
                </form>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-[#666]">{cantidad(s.equipos.length, "equipo", "equipos")} · {cantidad(s.jurados.length, "jurado", "jurados")}</span>
                  <form action={borrarSalon}>
                    <input type="hidden" name="evento_id" value={evento.id} />
                    <input type="hidden" name="salon_id" value={s.id} />
                    <BotonConfirmar mensaje={`¿Borrar "${s.nombre}"? Sus equipos y jurados quedan sin salón. No se borra ninguna nota.`}>Borrar</BotonConfirmar>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}

        <form action={crearSalon} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="evento_id" value={evento.id} />
          <div className="grid gap-2">
            <Label htmlFor="nombre-salon">Nuevo salón</Label>
            <Input id="nombre-salon" name="nombre" placeholder={resumen.length === 0 ? "Por ejemplo: Auditorio" : `Salón ${resumen.length + 1}`} className="min-w-64" required />
          </div>
          <Button type="submit" size="lg">Crear salón</Button>
        </form>
      </section>

      {/* 2. Asignaciones */}
      {resumen.length > 0 && (
        <section className="mb-14">
          <h2 className="mb-1 font-serif text-xl">Quién va a cada salón</h2>
          <p className="mb-6 text-sm text-[#666]">
            Cada equipo y cada jurado va a un solo salón en este evento. Los proyectos en borrador no aparecen porque no se evalúan.
          </p>

          {fueraDeJuego.length > 0 && (
            <div role="alert" className="mb-8 border border-destructive p-4 text-sm">
              <p className="font-medium text-destructive">Hay asignaciones que ya no se pueden evaluar: {fueraDeJuego.join(", ")}.</p>
              <p className="mt-1 text-[#666]">No aparecen en las listas de abajo. Cuando guardes las asignaciones, van a salir de su salón.</p>
            </div>
          )}

          <form action={guardarAsignaciones} className="grid gap-10">
            <input type="hidden" name="evento_id" value={evento.id} />

            <div>
              <h3 className="mb-3 text-sm font-medium">Equipos <span className="text-[#666]">· {equiposSinSalon.length} sin salón</span></h3>
              {proyectos.data!.length === 0 ? (
                <div className="border p-6 text-center text-sm text-[#666]">Todavía no hay proyectos publicados.</div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Proyecto</TableHead><TableHead className="w-36 sm:w-56">Salón</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {proyectos.data!.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="whitespace-normal break-words">
                          <label htmlFor={`proyecto-${p.id}`} className="font-medium">{p.nombre}</label>
                          {p.estado !== "publicado" && <Badge variant="outline" className="ml-2 capitalize">{p.estado}</Badge>}
                        </TableCell>
                        <TableCell>
                          <select id={`proyecto-${p.id}`} name={`proyecto:${p.id}`} defaultValue={salonDeProyecto.get(p.id) ?? ""} className={selectClase}>
                            <option value="">Sin salón</option>
                            {resumen.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                          </select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <div>
              <h3 className="mb-3 text-sm font-medium">Jurados <span className="text-[#666]">· {juradosSinSalon.length} sin salón</span></h3>
              {jurados.data!.length === 0 ? (
                <div className="border p-6 text-center text-sm text-[#666]">No hay jurados cargados. Se suman desde Miembros.</div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Jurado</TableHead><TableHead className="w-36 sm:w-56">Salón</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {jurados.data!.map((j) => (
                      <TableRow key={j.id}>
                        <TableCell className="whitespace-normal break-words"><label htmlFor={`jurado-${j.id}`} className="font-medium">{j.nombre}</label></TableCell>
                        <TableCell>
                          <select id={`jurado-${j.id}`} name={`jurado:${j.id}`} defaultValue={salonDeJurado.get(j.id) ?? ""} className={selectClase}>
                            <option value="">Sin salón</option>
                            {resumen.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                          </select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <div className="sticky bottom-0 flex justify-end border-t bg-background py-4">
              <Button type="submit" size="lg">Guardar asignaciones</Button>
            </div>
          </form>
        </section>
      )}
      </fieldset>

      {/* 3. Avance de las evaluaciones */}
      {resumen.length > 0 && (
        <section className="mb-14">
          <h2 className="mb-1 font-serif text-xl">Avance de las evaluaciones</h2>
          <p className="mb-6 text-sm text-[#666]">
            Qué jurados todavía no completaron, en {evento.nombre}, la planilla de los equipos de su salón.
            Una evaluación está completa cuando tiene nota en todos los criterios. Solo cuentan las notas de este evento.
          </p>

          <p className="mb-6">
            <span className="font-serif text-3xl">{pendientes.length}</span>
            <span className="ml-2 text-sm text-[#666]">{pendientes.length === 1 ? "jurado con evaluaciones pendientes" : "jurados con evaluaciones pendientes"}</span>
          </p>

          <div className="grid gap-8">
            {resumen.map((s) => (
              <div key={s.id}>
                <h3 className="mb-3 text-sm font-medium">{s.nombre}</h3>
                {s.jurados.length === 0 || s.equipos.length === 0 ? (
                  <p className="border p-4 text-sm text-[#666]">
                    {s.jurados.length === 0 ? "Este salón no tiene jurados asignados." : "Este salón no tiene equipos asignados."}
                  </p>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Jurado</TableHead><TableHead className="text-right">Completas</TableHead><TableHead>Le faltan</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {s.avance.map((j) => (
                        <TableRow key={j.id}>
                          <TableCell className="whitespace-normal font-medium">{j.nombre}</TableCell>
                          <TableCell className="text-right font-serif text-lg">{s.equipos.length - j.faltan.length}/{s.equipos.length}</TableCell>
                          <TableCell className="whitespace-normal text-sm">
                            {j.faltan.length === 0
                              ? <Badge variant="outline">Al día</Badge>
                              : <span className="text-[#666]">{j.faltan.map((p) => p.nombre).join(", ")}</span>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      {(sinEvento.count ?? 0) > 0 && (
        <p className="mb-14 border-l-2 border-primary pl-4 text-sm text-[#666]">
          Hay {cantidad(sinEvento.count ?? 0, "evaluación cargada", "evaluaciones cargadas")} antes de separar las notas por evento.
          Quedan guardadas sin cambios, pero no cuentan para ningún evento ni devolución.
        </p>
      )}
    </div>
  );
}
