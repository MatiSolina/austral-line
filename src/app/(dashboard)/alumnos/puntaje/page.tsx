// GRUPO ALUMNOS — "Puntaje": cuánto lleva cada alumno frente al mínimo para regularizar.
// El alumno ve sus puntos hito por hito. Los profesores fijan el mínimo y los puntos de cada hito, cargan las
// notas (del grupo o de cada alumno) y ven el estado de todos.
import { Suspense } from "react";
import Link from "next/link";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { estadoDe, numero, puntajeDe, type Estado, type HitoConPuntaje, type Nota } from "../_lib/puntaje";
import { guardarMaximo, guardarMinimo, guardarNotas } from "./_acciones";

const ZONA = "America/Argentina/Buenos_Aires";
const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", timeZone: ZONA });
const campo = "h-8 border bg-background px-2 text-sm tabular-nums";
const TIPOS: Record<string, string> = { grupal: "Grupal", individual: "Individual", ambas: "Grupal e individual" };

const ESTILO: Record<Estado, string> = {
  Regularizó: "border-primary bg-primary text-primary-foreground",
  "Puede regularizar": "",
  "No llega": "border-destructive text-destructive",
  "Sin mínimo": "",
};

async function Aviso({ searchParams }: Pick<PageProps<"/alumnos/puntaje">, "searchParams">) {
  const { error, ok } = await searchParams;
  if (error) return <p className="mb-6 border bg-card px-4 py-3 text-sm text-destructive">{String(error)}</p>;
  if (ok) return <p className="mb-6 border bg-card px-4 py-3 text-sm">{String(ok)}</p>;
  return null;
}

export default async function Puntaje({ searchParams }: PageProps<"/alumnos/puntaje">) {
  const persona = await requireRol("alumno");
  const esProfesor = persona.rol === "admin";
  const supabase = await createClient();

  const [config, eventos, maximos, notas, integrantes, tipos] = await Promise.all([
    supabase.from("alumnos_puntaje_config").select("minimo").eq("id", 1).maybeSingle(),
    supabase.from("eventos").select("id, nombre, inicio").order("inicio"),
    supabase.from("alumnos_puntaje_hitos").select("evento_id, maximo"),
    supabase.from("alumnos_notas").select("evento_id, proyecto_id, persona_id, puntos, comentario"),
    supabase.from("proyecto_integrantes").select("proyecto_id, persona_id, proyectos(nombre), personas(nombre)"),
    supabase.from("alumnos_hitos_tipo").select("evento_id, tipo"),
  ]);
  for (const r of [config, eventos, maximos, notas, integrantes, tipos]) if (r.error) throw r.error;

  const minimo = config.data?.minimo === null || config.data?.minimo === undefined ? null : Number(config.data.minimo);
  const maximoDe = new Map(maximos.data!.map((m) => [m.evento_id, Number(m.maximo)]));
  const hitos: HitoConPuntaje[] = eventos.data!.filter((e) => maximoDe.has(e.id)).map((e) => ({ ...e, maximo: maximoDe.get(e.id)! }));
  const totalPosible = hitos.reduce((s, h) => s + h.maximo, 0);
  const lista = notas.data! as Nota[];
  const proyectosDe = (id: string) => integrantes.data!.filter((i) => i.persona_id === id).map((i) => i.proyecto_id);

  const titulo = <h1 className="mb-2 font-serif text-2xl">Puntaje</h1>;

  // Vista del alumno -----------------------------------------------------------------------------
  if (!esProfesor) {
    const { filas, total, enJuego } = puntajeDe(persona.id, proyectosDe(persona.id), hitos, lista);
    const estado = estadoDe(total, enJuego, minimo);
    const falta = minimo === null ? null : Math.max(0, minimo - total);
    return (
      <>
        {titulo}
        <p className="mb-6 max-w-2xl text-sm text-[#666]">
          Tus puntos de cada hito y cuánto te falta para regularizar. En los hitos grupales cuenta la nota de tu grupo; en
          los individuales, la tuya.
        </p>
        <section className="mb-6 grid max-w-3xl gap-4 border bg-card p-6">
          <div className="flex flex-wrap items-end gap-x-10 gap-y-3">
            <div>
              <p className="text-xs text-[#666]">Llevás</p>
              <p className="font-serif text-4xl tabular-nums">{numero(total)}<span className="text-lg text-[#666]"> / {numero(totalPosible)}</span></p>
            </div>
            <div>
              <p className="text-xs text-[#666]">Mínimo para regularizar</p>
              <p className="font-serif text-4xl tabular-nums">{minimo === null ? "—" : numero(minimo)}</p>
            </div>
            <Badge variant="outline" className={cn("ml-auto", ESTILO[estado])}>{estado}</Badge>
          </div>
          {minimo !== null && totalPosible > 0 && (
            <div className="relative h-2 border bg-background" aria-hidden>
              <div className="absolute inset-y-0 left-0 bg-primary" style={{ width: `${Math.min(100, (total / totalPosible) * 100)}%` }} />
              <div className="absolute inset-y-[-4px] w-px bg-destructive" style={{ left: `${Math.min(100, (minimo / totalPosible) * 100)}%` }} />
            </div>
          )}
          <p className="text-sm">
            {minimo === null
              ? "Los profesores todavía no fijaron el mínimo para regularizar."
              : estado === "Regularizó"
                ? "¡Ya llegaste al mínimo para regularizar!"
                : estado === "Puede regularizar"
                  ? `Te faltan ${numero(falta!)} puntos. Quedan ${numero(enJuego)} en juego en los hitos que todavía no tienen nota.`
                  : `Te faltan ${numero(falta!)} puntos y con lo que queda en juego (${numero(enJuego)}) no alcanza. Hablá con los profesores.`}
          </p>
        </section>

        {filas.length === 0 ? (
          <p className="text-sm text-[#666]">Todavía no hay hitos con puntaje.</p>
        ) : (
          <div className="max-w-3xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Hito</TableHead><TableHead className="text-right">Puntos</TableHead><TableHead>Comentario</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>{f.nombre} <span className="text-[#666]">· {fecha(f.inicio)}</span></TableCell>
                    <TableCell className="text-right tabular-nums">
                      {f.puntos === null ? <span className="text-[#666]">Sin nota</span> : numero(f.puntos)}
                      <span className="text-[#666]"> / {numero(f.maximo)}</span>
                    </TableCell>
                    <TableCell className="whitespace-normal text-[#666]">
                      {f.comentario ?? ""}
                      {f.origen === "individual" && <span className="block text-xs">Nota individual</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </>
    );
  }

  // Vista de los profesores ---------------------------------------------------------------------
  const proyectos = [...new Map(integrantes.data!.map((i) => [i.proyecto_id, { id: i.proyecto_id, nombre: i.proyectos.nombre }])).values()].sort(
    (a, b) => a.nombre.localeCompare(b.nombre),
  );
  const { proyecto: elegido } = await searchParams;
  const proyecto = proyectos.find((p) => p.id === elegido) ?? proyectos[0];
  const miembros = proyecto ? integrantes.data!.filter((i) => i.proyecto_id === proyecto.id) : [];
  const tipoDe = new Map(tipos.data!.map((t) => [t.evento_id, t.tipo]));
  const alumnos = [...new Map(integrantes.data!.map((i) => [i.persona_id, i.personas.nombre])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const valor = (n: Nota | undefined) => (n ? String(Number(n.puntos)).replace(".", ",") : "");

  return (
    <>
      {titulo}
      <p className="mb-6 max-w-2xl text-sm text-[#666]">
        Fijá cuántos puntos vale cada hito y el mínimo para regularizar, y cargá las notas. En los hitos grupales la nota del
        grupo vale para todos; si le ponés una nota a un alumno, reemplaza a la del grupo solo para él.
      </p>
      <Suspense><Aviso searchParams={searchParams} /></Suspense>

      <div className="grid max-w-4xl gap-8">
        <section className="grid gap-4 border bg-card p-6">
          <h2 className="font-serif text-lg">Mínimo y puntos por hito</h2>
          <form action={guardarMinimo} className="flex flex-wrap items-center gap-2 text-sm">
            <input type="hidden" name="proyecto_id" value={proyecto?.id ?? ""} />
            <label htmlFor="minimo" className="text-[#666]">Mínimo total para regularizar:</label>
            <input id="minimo" name="minimo" inputMode="decimal" defaultValue={minimo === null ? "" : String(minimo).replace(".", ",")} className={cn(campo, "w-24")} />
            <Button type="submit" size="sm" variant="outline">Guardar</Button>
            <span className="text-xs text-[#666]">Hoy suman {numero(totalPosible)} puntos en total.</span>
          </form>
          <ul className="grid gap-2 text-sm">
            {eventos.data!.map((e) => (
              <li key={e.id}>
                <form action={guardarMaximo} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="evento_id" value={e.id} />
                  <input type="hidden" name="proyecto_id" value={proyecto?.id ?? ""} />
                  <span className="min-w-48">{e.nombre} <span className="text-[#666]">· {fecha(e.inicio)}</span></span>
                  <input
                    name="maximo"
                    inputMode="decimal"
                    aria-label={`Puntos de ${e.nombre}`}
                    placeholder="No suma"
                    defaultValue={maximoDe.has(e.id) ? String(maximoDe.get(e.id)).replace(".", ",") : ""}
                    className={cn(campo, "w-24")}
                  />
                  <span className="text-[#666]">puntos</span>
                  <Button type="submit" size="sm" variant="outline">Guardar</Button>
                </form>
              </li>
            ))}
          </ul>
        </section>

        <section className="grid gap-4 border bg-card p-6">
          <h2 className="font-serif text-lg">Cargar notas</h2>
          {proyectos.length === 0 ? (
            <p className="text-sm text-[#666]">Todavía no hay grupos.</p>
          ) : (
            <>
              <nav className="flex flex-wrap gap-2" aria-label="Grupo">
                {proyectos.map((p) => (
                  <Link
                    key={p.id}
                    href={`/alumnos/puntaje?proyecto=${p.id}`}
                    className={cn("border px-3 py-1 text-sm", p.id === proyecto!.id ? "border-primary bg-primary text-primary-foreground" : "hover:bg-background")}
                  >
                    {p.nombre}
                  </Link>
                ))}
              </nav>
              {hitos.length === 0 && <p className="text-sm text-[#666]">Primero fijá cuántos puntos vale algún hito.</p>}
              {hitos.map((h) => {
                const tipo = tipoDe.get(h.id) ?? "grupal";
                const pideGrupal = tipo !== "individual";
                const delGrupo = lista.find((n) => n.evento_id === h.id && n.proyecto_id === proyecto!.id);
                return (
                  <form key={h.id} action={guardarNotas} className="grid gap-3 border bg-background p-4 text-sm">
                    <input type="hidden" name="evento_id" value={h.id} />
                    <input type="hidden" name="proyecto_id" value={proyecto!.id} />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{h.nombre}</span>
                      <span className="text-[#666]">· vale {numero(h.maximo)} · {TIPOS[tipo] ?? tipo}</span>
                    </div>
                    {pideGrupal && (
                      <div className="flex flex-wrap items-center gap-2">
                        <label htmlFor={`grupo-${h.id}`} className="min-w-40 text-[#666]">Nota del grupo</label>
                        <input id={`grupo-${h.id}`} name="grupo" inputMode="decimal" defaultValue={valor(delGrupo)} className={cn(campo, "w-20")} />
                        <input
                          name="comentario_grupo"
                          maxLength={500}
                          placeholder="Comentario (opcional)"
                          aria-label="Comentario para el grupo"
                          defaultValue={delGrupo?.comentario ?? ""}
                          className={cn(campo, "min-w-48 flex-1")}
                        />
                      </div>
                    )}
                    {miembros.map((m) => {
                      const suya = lista.find((n) => n.evento_id === h.id && n.persona_id === m.persona_id);
                      return (
                        <div key={m.persona_id} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="integrante" value={m.persona_id} />
                          <label htmlFor={`a-${h.id}-${m.persona_id}`} className="min-w-40">{m.personas.nombre}</label>
                          <input
                            id={`a-${h.id}-${m.persona_id}`}
                            name={`alumno_${m.persona_id}`}
                            inputMode="decimal"
                            defaultValue={valor(suya)}
                            placeholder={pideGrupal ? "Igual al grupo" : "Sin nota"}
                            className={cn(campo, "w-28")}
                          />
                        </div>
                      );
                    })}
                    <div><Button type="submit" size="sm">Guardar notas de {h.nombre}</Button></div>
                  </form>
                );
              })}
            </>
          )}
        </section>

        <section className="grid gap-3">
          <h2 className="font-serif text-lg">Estado de los alumnos</h2>
          <div className="border bg-card">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Alumno</TableHead><TableHead className="text-right">Puntos</TableHead><TableHead className="text-right">En juego</TableHead><TableHead>Estado</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {alumnos.map(([id, nombre]) => {
                  const { total, enJuego } = puntajeDe(id, proyectosDe(id), hitos, lista);
                  const estado = estadoDe(total, enJuego, minimo);
                  return (
                    <TableRow key={id}>
                      <TableCell>{nombre}</TableCell>
                      <TableCell className="text-right tabular-nums">{numero(total)}</TableCell>
                      <TableCell className="text-right tabular-nums text-[#666]">{numero(enJuego)}</TableCell>
                      <TableCell><Badge variant="outline" className={ESTILO[estado]}>{estado}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </>
  );
}
