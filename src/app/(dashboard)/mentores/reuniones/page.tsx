// GRUPO MENTORES — reuniones de mentoría. 24 h antes de cada una, el asistente le manda al mentor un resumen.
import Link from "next/link";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { modoPrueba } from "../_resend";
import { crearReunion, marcarAviso } from "./acciones";
import { hayIA, urlBase } from "./agente";
import { BotonGuardar } from "./boton-guardar";
import { estadoResumen, metricas, vigente, type Tono } from "./estado";
import { fechaCorta, fechaHora } from "./fechas";
import { pedirFeedback } from "../feedback/agente";

const variantes: Record<Tono, "default" | "outline" | "destructive" | "secondary"> = {
  ok: "default",
  pendiente: "outline",
  error: "destructive",
  neutro: "secondary",
};

export default async function Reuniones({ searchParams }: PageProps<"/mentores/reuniones">) {
  const persona = await requireRol("mentor");
  const esAdmin = persona.rol === "admin";
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  await pedirFeedback(supabase, await urlBase()); // las reuniones que ya terminaron piden su feedback

  // Cada mentor ve solo sus reuniones (lo asegura la base); el coordinador ve todas.
  const [reuniones, proyectos, mentores] = await Promise.all([
    supabase
      .from("mentores_reuniones")
      .select("id, inicio, lugar, notas, cancelada, proyectos(nombre), mentor:personas!mentores_reuniones_mentor_id_fkey(nombre), mentores_resumenes(id, estado, programado_para, created_at, leido_at, aviso, aviso_util, aviso_mail_at, le_sirvio, minutos_ahorrados)")
      .order("inicio"),
    supabase.from("proyectos").select("id, nombre").order("nombre"),
    supabase.from("personas").select("id, nombre").eq("rol", "mentor").order("nombre"),
  ]);
  for (const r of [reuniones, proyectos, mentores]) if (r.error) throw r.error;

  const ahora = new Date().getTime(); // Server Component: se calcula una vez por pedido
  const lista = reuniones.data!;
  const proximas = lista.filter((r) => new Date(r.inicio).getTime() > ahora);
  const anteriores = lista.filter((r) => new Date(r.inicio).getTime() <= ahora).reverse();
  const m = metricas(lista, ahora);
  const avisos = lista
    .map((r) => ({ reunion: r, resumen: vigente(r.mentores_resumenes) }))
    .filter(({ resumen }) => !!resumen?.aviso)
    .sort((a, b) => b.resumen!.created_at.localeCompare(a.resumen!.created_at));

  const filas = (rs: typeof lista, conNotas: boolean) =>
    rs.map((r) => {
      const estado = estadoResumen(r, r.mentores_resumenes, ahora);
      return (
        <TableRow key={r.id} className={r.cancelada ? "text-[#666]" : undefined}>
          <TableCell className="whitespace-nowrap">{fechaCorta(r.inicio)}</TableCell>
          <TableCell>{r.proyectos.nombre}</TableCell>
          {esAdmin && <TableCell className="text-[#666]">{r.mentor.nombre}</TableCell>}
          <TableCell><Badge variant={variantes[estado.tono]}>{estado.texto}</Badge></TableCell>
          {conNotas && <TableCell className="text-[#666]">{r.cancelada ? "—" : r.notas ? "Cargadas" : "Sin notas"}</TableCell>}
          <TableCell className="text-right">
            <Link href={`/mentores/reuniones/${r.id}`} className="text-sm underline underline-offset-4 hover:text-primary">Ver</Link>
          </TableCell>
        </TableRow>
      );
    });

  const encabezado = (conNotas: boolean) => (
    <TableHeader>
      <TableRow>
        <TableHead>Cuándo</TableHead>
        <TableHead>Proyecto</TableHead>
        {esAdmin && <TableHead>Mentor</TableHead>}
        <TableHead>Resumen</TableHead>
        {conNotas && <TableHead>Notas</TableHead>}
        <TableHead />
      </TableRow>
    </TableHeader>
  );

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/mentores" className="text-sm text-[#666] hover:text-primary">← Mentores</Link>
      <h1 className="mt-6 font-serif text-2xl">Reuniones</h1>
      <p className="mt-1 mb-8 text-sm text-[#666]">
        24 h antes de cada reunión, el asistente le manda al mentor un resumen para prepararla: el equipo, en qué está el proyecto
        y qué quedó pendiente. Después de la reunión, cargá las notas: son lo que usa para la próxima.
      </p>

      {(modoPrueba() || !hayIA()) && (
        <div className="mb-6 grid gap-1 border-l-2 border-primary pl-4 text-sm text-[#666]">
          {modoPrueba() && <p>Modo prueba: falta la clave de Resend (<code>RESEND_API_KEY</code>), así que los resúmenes se registran como &quot;simulado&quot; y no sale ningún mail.</p>}
          {!hayIA() && <p>Falta la clave de IA (<code>AI_GATEWAY_API_KEY</code>): los resúmenes salen solo con los datos cargados, sin la síntesis ni los avisos de la IA.</p>}
        </div>
      )}
      {typeof ok === "string" && <p className="mb-6 border-l-2 border-primary pl-4 text-sm">{ok}</p>}
      {typeof error === "string" && <p className="mb-6 border-l-2 border-destructive pl-4 text-sm text-destructive">{error}</p>}

      {esAdmin && (
        <section className="mb-12">
          <div className="grid gap-px border bg-border sm:grid-cols-2 lg:grid-cols-5">
            {[
              { titulo: "Resumen a tiempo", valor: `${m.aTiempo} de ${m.debian}`, detalle: "reuniones que ya debían tenerlo" },
              { titulo: "Leídos", valor: `${m.leidos} de ${m.aTiempo}`, detalle: "el mentor lo abrió en la app" },
              { titulo: "Les sirvió", valor: `${m.lesSirvio} de ${m.opinaron}`, detalle: "mentores que opinaron" },
              {
                titulo: "Tiempo ahorrado",
                valor: `${m.minutosAhorrados} min`,
                detalle: m.conMinutos ? `promedio ${Math.round(m.minutosAhorrados / m.conMinutos)} min por reunión` : "ningún mentor lo cargó todavía",
              },
              { titulo: "Avisos al coordinador", valor: String(m.avisos), detalle: `${m.avisosPorMail} por mail · sirvieron ${m.avisosUtiles} de ${m.avisosMarcados}` },
            ].map((t) => (
              <div key={t.titulo} className="bg-background p-6">
                <p className="text-sm text-[#666]">{t.titulo}</p>
                <p className="mt-2 font-serif text-3xl">{t.valor}</p>
                <p className="mt-1 text-xs text-[#666]">{t.detalle}</p>
              </div>
            ))}
          </div>

          {avisos.length > 0 && (
            <div id="avisos" className="mt-8">
              <h2 className="mb-4 font-serif text-xl">Avisos del asistente</h2>
              <div className="grid gap-3">
                {avisos.map(({ reunion, resumen }) => (
                  <div key={resumen!.id} className="border p-4 text-sm">
                    <p className="text-[#666]">
                      <Link href={`/mentores/reuniones/${reunion.id}`} className="text-primary underline underline-offset-4">{reunion.proyectos.nombre}</Link>
                      {" · "}{reunion.mentor.nombre} · {fechaHora(reunion.inicio)}
                    </p>
                    <p className="mt-2">{resumen!.aviso}</p>
                    <form action={marcarAviso} className="mt-3 flex items-center gap-2">
                      <input type="hidden" name="resumen_id" value={resumen!.id} />
                      <span className="mr-1 text-[#666]">¿Te sirvió?</span>
                      <Button type="submit" name="util" value="si" size="sm" variant={resumen!.aviso_util === true ? "default" : "outline"}>Sí</Button>
                      <Button type="submit" name="util" value="no" size="sm" variant={resumen!.aviso_util === false ? "default" : "outline"}>No</Button>
                    </form>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <section className="mb-12">
        <h2 className="mb-4 font-serif text-xl">Nueva reunión</h2>
        <form action={crearReunion} className="grid gap-4 border p-6 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="proyecto_id">Proyecto</Label>
            <select id="proyecto_id" name="proyecto_id" required defaultValue="" className="h-9 border bg-background px-2 text-sm">
              <option value="" disabled>Elegí un proyecto</option>
              {proyectos.data!.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          {esAdmin && (
            <div className="grid gap-2">
              <Label htmlFor="mentor_id">Mentor</Label>
              <select id="mentor_id" name="mentor_id" required defaultValue="" className="h-9 border bg-background px-2 text-sm">
                <option value="" disabled>Elegí un mentor</option>
                {mentores.data!.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="inicio">Fecha y hora</Label>
            <Input id="inicio" name="inicio" type="datetime-local" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="lugar">Lugar o link</Label>
            <Input id="lugar" name="lugar" placeholder="Sala 3 o https://meet.google.com/…" />
          </div>
          <div className="md:col-span-2">
            <BotonGuardar pendiente="Guardando y armando el resumen…">Guardar reunión</BotonGuardar>
          </div>
        </form>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 font-serif text-xl">Próximas</h2>
        {proximas.length === 0 ? (
          <p className="border p-6 text-center text-sm text-[#666]">No hay reuniones próximas.</p>
        ) : (
          <Table>{encabezado(false)}<TableBody>{filas(proximas, false)}</TableBody></Table>
        )}
      </section>

      <section>
        <h2 className="mb-4 font-serif text-xl">Anteriores</h2>
        {anteriores.length === 0 ? (
          <p className="border p-6 text-center text-sm text-[#666]">Todavía no hubo reuniones.</p>
        ) : (
          <Table>{encabezado(true)}<TableBody>{filas(anteriores, true)}</TableBody></Table>
        )}
      </section>
    </div>
  );
}
