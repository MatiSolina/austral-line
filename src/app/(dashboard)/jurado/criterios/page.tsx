// GRUPO JURADO — criterios de evaluación: qué puntúan los jurados en cada evento. Solo el admin/organizador.
// Cada evento tiene sus propios criterios y quedan fijos desde que recibe la primera evaluación.
// La "lista base" es el punto de partida de los eventos nuevos.
import Link from "next/link";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BotonConfirmar } from "../_components/boton-confirmar";
import { fechaHora } from "../comunicaciones/plantillas";
import { aplicarLista, crearCriterio, guardarCriterio, moverCriterio, quitarCriterio } from "./acciones";

type Criterio = { id: string; nombre: string; descripcion: string | null };

export default async function Criterios({ searchParams }: PageProps<"/jurado/criterios">) {
  await requireRol(); // solo admin
  const { evento: elegido, ok, error } = await searchParams;
  const supabase = await createClient();

  const { data: eventos, error: errorEventos } = await supabase.from("eventos").select("id, nombre, inicio").order("inicio");
  if (errorEventos) throw errorEventos;
  const ahora = new Date().toISOString();
  const esBase = elegido === "base";
  const evento = esBase ? null : (eventos.find((e) => e.id === elegido) ?? eventos.find((e) => e.inicio > ahora) ?? eventos.at(-1) ?? null);
  const ambito = esBase ? "base" : evento?.id;

  // Los criterios de la lista que se está mirando.
  let criterios: Criterio[] = [];
  if (esBase) {
    const { data, error: errorBase } = await supabase.from("jurado_criterios").select("id, nombre, descripcion").eq("es_base", true).order("orden").order("nombre");
    if (errorBase) throw errorBase;
    criterios = data;
  } else if (evento) {
    const { data, error: errorEvento } = await supabase
      .from("jurado_evento_criterios").select("orden, jurado_criterios(id, nombre, descripcion)").eq("evento_id", evento.id).order("orden");
    if (errorEvento) throw errorEvento;
    criterios = data.map((r) => r.jurado_criterios);
  }

  // ¿Ya recibió evaluaciones? Entonces los criterios del evento están fijos. Y cuántas notas tiene cada criterio.
  let evaluaciones = 0;
  let publicado = false;
  if (evento) {
    const [ev, pub] = await Promise.all([
      supabase.from("jurado_evaluaciones").select("id", { count: "exact", head: true }).eq("evento_id", evento.id),
      supabase.from("jurado_publicaciones").select("evento_id").eq("evento_id", evento.id).maybeSingle(),
    ]);
    if (ev.error) throw ev.error;
    if (pub.error) throw pub.error;
    evaluaciones = ev.count ?? 0;
    publicado = !!pub.data;
  }
  const fijo = evaluaciones > 0 || publicado;
  // Solo las notas de este evento: las cargadas antes de separar por evento no cuentan para ninguno.
  const notas = new Map(await Promise.all(criterios.map(async (c) => {
    if (!evento) return [c.id, 0] as const;
    const { count, error: errorNotas } = await supabase
      .from("jurado_puntajes")
      .select("criterio_id, jurado_evaluaciones!inner(evento_id)", { count: "exact", head: true })
      .eq("criterio_id", c.id)
      .eq("jurado_evaluaciones.evento_id", evento.id);
    if (errorNotas) throw errorNotas;
    return [c.id, count ?? 0] as const;
  })));

  // Eventos de los que se pueden copiar criterios.
  const { data: conCriterios, error: errorCon } = await supabase.from("jurado_evento_criterios").select("evento_id");
  if (errorCon) throw errorCon;
  const idsConCriterios = new Set(conCriterios.map((c) => c.evento_id));
  const origenes = eventos.filter((e) => e.id !== evento?.id && idsConCriterios.has(e.id));

  const editable = esBase || (!!evento && !fijo);
  const selectClase = "h-9 min-w-64 border bg-background px-2 text-sm";

  const formsAplicar = evento && !fijo && (
    <div className="grid gap-4 sm:grid-cols-2">
      <form action={aplicarLista} className="grid gap-2 border p-4">
        <input type="hidden" name="ambito" value={evento.id} />
        <input type="hidden" name="origen" value="base" />
        <p className="text-sm font-medium">Lista base</p>
        <p className="text-sm text-[#666]">Los criterios de partida (se ven eligiendo «Lista base» arriba).</p>
        {criterios.length > 0
          ? <BotonConfirmar variant="outline" size="lg" mensaje="¿Reemplazar los criterios de este evento por la lista base?">Usar la lista base</BotonConfirmar>
          : <Button type="submit" variant="outline" size="lg">Usar la lista base</Button>}
      </form>
      <form action={aplicarLista} className="grid gap-2 border p-4">
        <input type="hidden" name="ambito" value={evento.id} />
        <p className="text-sm font-medium">Copiar de otro evento</p>
        {origenes.length === 0 ? (
          <p className="text-sm text-[#666]">Ningún otro evento tiene criterios todavía.</p>
        ) : (
          <>
            <select name="origen" aria-label="Evento del que copiar" className={selectClase} defaultValue={origenes[0].id}>
              {origenes.map((o) => <option key={o.id} value={o.id}>{o.nombre} · {fechaHora(o.inicio)}</option>)}
            </select>
            <BotonConfirmar variant="outline" size="lg" mensaje="¿Reemplazar los criterios de este evento por una copia de los del evento elegido?">Copiar sus criterios</BotonConfirmar>
          </>
        )}
      </form>
    </div>
  );

  const armar = formsAplicar && (
        <section>
          <h2 className="mb-1 font-serif text-xl">{criterios.length === 0 ? "Armar los criterios" : "Volver a empezar"}</h2>
          <p className="mb-6 text-sm text-[#666]">
            {criterios.length === 0
              ? "Elegí de dónde partir. Después los podés ajustar hasta que llegue la primera evaluación."
              : "Reemplaza los criterios de este evento. Solo se puede mientras no recibió evaluaciones."}
          </p>
          {formsAplicar}
        </section>
      );

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/jurado" className="text-sm text-[#666] hover:text-primary">← Proyectos</Link>
      <h1 className="mt-6 font-serif text-2xl">Criterios de evaluación</h1>
      <p className="mt-1 mb-8 text-sm text-[#666]">
        Lo que puntúan los jurados, de 1 a 10. Cada evento tiene sus propios criterios, y quedan fijos desde que recibe la primera evaluación.
        Un cambio en un evento no toca las notas, los promedios ni las devoluciones de otro.
      </p>

      {typeof ok === "string" && <p className="mb-6 border-l-2 border-primary pl-4 text-sm">{ok}</p>}
      {typeof error === "string" && <p role="alert" className="mb-6 border-l-2 border-destructive pl-4 text-sm text-destructive">{error}</p>}

      <form className="mb-10 flex flex-wrap items-end gap-3">
        <div className="grid gap-2">
          <Label htmlFor="evento">Ver los criterios de</Label>
          <select id="evento" name="evento" defaultValue={esBase ? "base" : evento?.id} className={selectClase}>
            <option value="base">Lista base (punto de partida)</option>
            {eventos.map((e) => <option key={e.id} value={e.id}>{e.nombre} · {fechaHora(e.inicio)}</option>)}
          </select>
        </div>
        <Button type="submit" variant="outline" size="lg">Ver</Button>
      </form>

      {esBase && (
        <p className="mb-8 border-l-2 border-primary pl-4 text-sm text-[#666]">
          La lista base es el punto de partida: cada evento nuevo recibe una copia al armarle el primer salón. Cambiarla no modifica los eventos que ya tienen sus criterios.
        </p>
      )}
      {!esBase && !evento && <div className="border p-10 text-center text-sm text-[#666]">No hay eventos cargados. Los eventos los carga el grupo Austral.</div>}
      {evento && fijo && (
        <p className="mb-8 border-l-2 border-primary pl-4 text-sm text-[#666]">
          Criterios fijos: {publicado ? "las devoluciones de este evento ya se publicaron" : `este evento ya recibió ${evaluaciones} ${evaluaciones === 1 ? "evaluación" : "evaluaciones"}`}.
          {" "}Para otro evento, ajustá sus propios criterios.
        </p>
      )}
      {evento && !fijo && criterios.length === 0 && (
        <div className="mb-8">
          <p className="mb-4 text-sm text-[#666]">
            <span className="font-medium text-foreground">{evento.nombre}</span> todavía no tiene criterios, así que no puede recibir evaluaciones. Empezá con la lista base o copiá los de otro evento.
          </p>
        </div>
      )}

      {(esBase || evento) && criterios.length > 0 && (
        <section className="mb-14">
          <h2 className="mb-4 font-serif text-xl">{esBase ? "Lista base" : `Criterios de ${evento!.nombre}`}</h2>
          <div className="border">
            {criterios.map((c, i) => {
              const usadas = notas.get(c.id) ?? 0;
              return (
                <div key={c.id} className="grid gap-4 border-b p-4 last:border-b-0">
                  <div className="flex flex-wrap items-center gap-3">
                    {!esBase && <Badge variant="outline">{fijo ? "Fijo" : "Se puede cambiar"}</Badge>}
                    <span className="text-sm text-[#666]">
                      {usadas === 0 ? "Sin notas todavía" : `${usadas} ${usadas === 1 ? "nota cargada" : "notas cargadas"}`}
                    </span>
                    {editable && (
                      <div className="ml-auto flex items-center gap-1">
                        {(["subir", "bajar"] as const).map((direccion) => (
                          <form key={direccion} action={moverCriterio}>
                            <input type="hidden" name="ambito" value={ambito} />
                            <input type="hidden" name="criterio_id" value={c.id} />
                            <input type="hidden" name="direccion" value={direccion} />
                            <Button
                              type="submit" variant="ghost" size="sm"
                              disabled={direccion === "subir" ? i === 0 : i === criterios.length - 1}
                              aria-label={`${direccion === "subir" ? "Subir" : "Bajar"} ${c.nombre}`}
                            >
                              {direccion === "subir" ? "Subir" : "Bajar"}
                            </Button>
                          </form>
                        ))}
                      </div>
                    )}
                  </div>

                  {editable && usadas === 0 ? (
                    <form action={guardarCriterio} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
                      <input type="hidden" name="ambito" value={ambito} />
                      <input type="hidden" name="criterio_id" value={c.id} />
                      <div className="grid gap-2">
                        <Label htmlFor={`nombre-${c.id}`} className="text-xs text-[#666]">Nombre</Label>
                        <Input id={`nombre-${c.id}`} name="nombre" defaultValue={c.nombre} required maxLength={60} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor={`descripcion-${c.id}`} className="text-xs text-[#666]">Qué se evalúa (lo ve el jurado)</Label>
                        <Input id={`descripcion-${c.id}`} name="descripcion" defaultValue={c.descripcion ?? ""} maxLength={200} />
                      </div>
                      <Button type="submit" variant="outline" size="sm">Guardar</Button>
                    </form>
                  ) : (
                    <div>
                      <p className="font-medium">{c.nombre}</p>
                      {c.descripcion && <p className="mt-1 text-sm text-[#666]">{c.descripcion}</p>}
                    </div>
                  )}

                  {editable && usadas === 0 && (
                    <form action={quitarCriterio}>
                      <input type="hidden" name="ambito" value={ambito} />
                      <input type="hidden" name="criterio_id" value={c.id} />
                      <BotonConfirmar mensaje={`¿Quitar "${c.nombre}"${esBase ? " de la lista base" : " de este evento"}?`}>Quitar</BotonConfirmar>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {criterios.length === 0 && armar}

      {editable && (esBase || evento) && (
        <section className="mb-14">
          <h2 className="mb-1 font-serif text-xl">Sumar un criterio</h2>
          <p className="mb-6 text-sm text-[#666]">Queda al final de la lista. Podés reordenarlo después.</p>
          <form action={crearCriterio} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
            <input type="hidden" name="ambito" value={ambito} />
            <div className="grid gap-2">
              <Label htmlFor="nombre-nuevo">Nombre</Label>
              <Input id="nombre-nuevo" name="nombre" required maxLength={60} placeholder="Por ejemplo, Impacto" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="descripcion-nuevo">Qué se evalúa (lo ve el jurado)</Label>
              <Input id="descripcion-nuevo" name="descripcion" maxLength={200} placeholder="¿Qué le tiene que mirar el jurado?" />
            </div>
            <Button type="submit" size="lg">Sumar criterio</Button>
          </form>
        </section>
      )}


      {criterios.length > 0 && armar}
    </div>
  );
}
