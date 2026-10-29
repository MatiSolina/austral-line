// GRUPO MENTORES — una reunión: su resumen pre-reunión, las notas y los cambios de fecha o lugar.
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cancelarReunion, editarReunion, guardarNotas, opinarResumen, reactivarReunion, rehacerResumen } from "../acciones";
import { BotonGuardar } from "../boton-guardar";
import { enEspera, estadoResumen, vigente, yaSalio, type Tono } from "../estado";
import { fechaCorta, fechaHora, paraInput } from "../fechas";

const variantes: Record<Tono, "default" | "outline" | "destructive" | "secondary"> = {
  ok: "default",
  pendiente: "outline",
  error: "destructive",
  neutro: "secondary",
};

const nombresEstado: Record<string, string> = {
  programado: "Programado",
  simulado: "Simulado",
  enviado: "Enviado",
  reemplazado: "Reemplazado",
  cancelado: "Cancelado",
  error: "Error",
};

const areaTexto = "w-full border bg-transparent p-3 text-sm outline-none focus-visible:border-ring";

const opcionesMinutos = [0, 5, 15, 30, 60];
const minutos = (m: number) => (m === 0 ? "nada" : m >= 60 ? "1 hora o más" : `${m} min`);

export default async function Reunion({ params, searchParams }: PageProps<"/mentores/reuniones/[id]">) {
  const persona = await requireRol("mentor");
  const esAdmin = persona.rol === "admin";
  const [{ id }, { ok, error }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();

  const { data: r, error: errorReunion } = await supabase
    .from("mentores_reuniones")
    .select("id, inicio, lugar, notas, proximos_pasos, cancelada, mentor_id, proyectos(nombre), mentor:personas!mentores_reuniones_mentor_id_fkey(nombre), mentores_resumenes(id, html, con_ia, aviso, aviso_mail_at, estado, programado_para, created_at, leido_at, error, le_sirvio, minutos_ahorrados)")
    .eq("id", id)
    .maybeSingle();
  if (errorReunion?.code === "22P02") notFound(); // id con formato inválido
  if (errorReunion) throw errorReunion;
  if (!r) notFound(); // no existe o es de otro mentor

  const ahora = new Date().getTime(); // Server Component: se calcula una vez por pedido
  const actual = vigente(r.mentores_resumenes);
  const salio = !!actual && yaSalio(actual, ahora);
  // El mentor abrió en la app el resumen que le llegó: cuenta como leído para las métricas.
  if (actual && salio && !actual.leido_at && persona.id === r.mentor_id) {
    const { error: errorLeido } = await supabase.from("mentores_resumenes").update({ leido_at: new Date().toISOString() }).eq("id", actual.id);
    if (errorLeido) throw errorLeido;
  }

  const estado = estadoResumen(r, r.mentores_resumenes, ahora);
  const futura = new Date(r.inicio).getTime() > ahora;
  const puedeRehacer = !r.cancelada && futura && !salio && !enEspera(r.inicio, ahora);
  const historial = [...r.mentores_resumenes].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const ultimoError = historial.find((h) => h.estado === "error");
  const sinResumen = r.cancelada
    ? "La reunión está cancelada: no se manda resumen."
    : !futura
      ? "Esta reunión no tuvo resumen."
      : enEspera(r.inicio, ahora)
        ? "Falta más de un mes para la reunión: el asistente arma el resumen más adelante, cuando falte menos."
        : ultimoError
          ? `No se pudo programar el resumen: ${ultimoError.error ?? "error desconocido"}`
          : "Todavía no hay resumen.";

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/mentores/reuniones" className="text-sm text-[#666] hover:text-primary">← Reuniones</Link>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-2xl">{r.proyectos.nombre}</h1>
        {r.cancelada && <Badge variant="secondary">Cancelada</Badge>}
      </div>
      <p className="mt-1 mb-8 text-sm text-[#666]">
        {fechaHora(r.inicio)} · {r.lugar ?? "sin lugar ni link"}{esAdmin && ` · ${r.mentor.nombre}`}
      </p>

      {typeof ok === "string" && <p className="mb-6 border-l-2 border-primary pl-4 text-sm">{ok}</p>}
      {typeof error === "string" && <p className="mb-6 border-l-2 border-destructive pl-4 text-sm text-destructive">{error}</p>}

      <section className="mb-14">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-xl">Resumen pre-reunión</h2>
          <Badge variant={variantes[estado.tono]}>{estado.texto}</Badge>
        </div>
        {esAdmin && actual?.aviso && (
          <p className="mb-4 border-l-2 border-destructive pl-4 text-sm">
            <span className="font-medium">Aviso para el coordinador:</span> {actual.aviso}
            {actual.aviso_mail_at && <span className="text-[#666]"> (se mandó por mail el {fechaCorta(actual.aviso_mail_at)})</span>}
          </p>
        )}
        {esAdmin && actual && actual.le_sirvio !== null && (
          <p className="mb-4 text-sm text-[#666]">
            Opinión del mentor: {actual.le_sirvio ? "le sirvió" : "no le sirvió"}
            {actual.minutos_ahorrados !== null && ` · le ahorró ${minutos(actual.minutos_ahorrados)} de preparación`}.
          </p>
        )}
        {actual ? (
          <>
            <p className="mb-3 text-sm text-[#666]">
              {salio
                ? `Le llegó al mentor el ${fechaHora(actual.programado_para ?? actual.created_at)}`
                : `Le llega al mentor el ${fechaHora(actual.programado_para!)}`}
              {actual.con_ia ? "." : ", sin la síntesis de IA."}
            </p>
            <iframe title="Resumen pre-reunión" sandbox="" srcDoc={actual.html} className="h-[560px] w-full border bg-white" />
            {salio && persona.id === r.mentor_id && (
              <form action={opinarResumen} className="mt-4 grid gap-4 border p-4 text-sm">
                <input type="hidden" name="resumen_id" value={actual.id} />
                <input type="hidden" name="reunion_id" value={r.id} />
                <p className="font-medium">¿Te sirvió el resumen para preparar la reunión?</p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="minutos">Tiempo de preparación que te ahorró</Label>
                    <select id="minutos" name="minutos" defaultValue={String(actual.minutos_ahorrados ?? "")} className="h-9 border bg-background px-2 text-sm">
                      <option value="">Prefiero no decir</option>
                      {opcionesMinutos.map((m) => <option key={m} value={m}>{minutos(m)}</option>)}
                    </select>
                  </div>
                  <Button type="submit" name="le_sirvio" value="si" size="lg" variant={actual.le_sirvio === true ? "default" : "outline"}>Sí, me sirvió</Button>
                  <Button type="submit" name="le_sirvio" value="no" size="lg" variant={actual.le_sirvio === false ? "default" : "outline"}>No me sirvió</Button>
                </div>
              </form>
            )}
          </>
        ) : (
          <p className="border p-6 text-center text-sm text-[#666]">{sinResumen}</p>
        )}
        {puedeRehacer && (
          <form action={rehacerResumen} className="mt-4">
            <input type="hidden" name="id" value={r.id} />
            <BotonGuardar variant="outline" pendiente="Armando el resumen…">
              {actual ? "Volver a armar el resumen" : "Armar el resumen ahora"}
            </BotonGuardar>
          </form>
        )}
      </section>

      {!r.cancelada && (
        <section className="mb-14">
          <h2 className="mb-1 font-serif text-xl">Notas de la reunión</h2>
          <p className="mb-4 text-sm text-[#666]">
            Qué se habló y qué quedó pendiente. El asistente las usa en el resumen de la próxima reunión con este equipo.
          </p>
          <form action={guardarNotas} className="grid gap-4">
            <input type="hidden" name="id" value={r.id} />
            <div className="grid gap-2">
              <Label htmlFor="notas">Qué se habló</Label>
              <textarea id="notas" name="notas" rows={5} defaultValue={r.notas ?? ""} className={areaTexto} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="proximos_pasos">Próximos pasos</Label>
              <textarea id="proximos_pasos" name="proximos_pasos" rows={3} defaultValue={r.proximos_pasos ?? ""} className={areaTexto} />
            </div>
            <div><BotonGuardar pendiente="Guardando y actualizando resúmenes…">Guardar notas</BotonGuardar></div>
          </form>
        </section>
      )}

      <section className="mb-14">
        <h2 className="mb-4 font-serif text-xl">Fecha y lugar</h2>
        {r.cancelada ? (
          <form action={reactivarReunion}>
            <input type="hidden" name="id" value={r.id} />
            <BotonGuardar variant="outline" pendiente="Activando…">Volver a activar la reunión</BotonGuardar>
          </form>
        ) : (
          <>
            <form action={editarReunion} className="grid gap-4 md:grid-cols-2">
              <input type="hidden" name="id" value={r.id} />
              <div className="grid gap-2">
                <Label htmlFor="inicio">Fecha y hora</Label>
                <Input id="inicio" name="inicio" type="datetime-local" required defaultValue={paraInput(r.inicio)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lugar">Lugar o link</Label>
                <Input id="lugar" name="lugar" defaultValue={r.lugar ?? ""} placeholder="Sala 3 o https://meet.google.com/…" />
              </div>
              <div className="md:col-span-2"><BotonGuardar pendiente="Guardando y rehaciendo el resumen…">Guardar cambios</BotonGuardar></div>
            </form>
            <form action={cancelarReunion} className="mt-6">
              <input type="hidden" name="id" value={r.id} />
              <Button type="submit" variant="destructive" size="lg">Cancelar reunión</Button>
            </form>
          </>
        )}
      </section>

      {historial.length > 0 && (
        <section>
          <h2 className="mb-4 font-serif text-xl">Historial de resúmenes</h2>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Armado</TableHead><TableHead>Envío</TableHead><TableHead>Estado</TableHead><TableHead>IA</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {historial.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="text-[#666]">{fechaCorta(h.created_at)}</TableCell>
                  <TableCell className="text-[#666]">{h.programado_para ? fechaCorta(h.programado_para) : "En el momento"}</TableCell>
                  <TableCell>
                    <Badge variant={h.estado === "error" ? "destructive" : "outline"} title={h.error ?? undefined}>{nombresEstado[h.estado] ?? h.estado}</Badge>
                  </TableCell>
                  <TableCell className="text-[#666]">{h.con_ia ? "Sí" : "No"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}
    </div>
  );
}
