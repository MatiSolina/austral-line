// GRUPO AUSTRAL — recomendaciones del agente de matching (solo admin).
// Ranking de candidatos por proyecto (o de proyectos por alumno), con el puntaje de cada criterio para comparar,
// las alertas que necesitan intervención y las propuestas aceptadas que falta confirmar.
import Link from "next/link";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BotonEnviar } from "../_components/boton-enviar";
import { Encabezado, selectClase } from "./_components/encabezado";
import { cargarMatching, claseEstado } from "./_datos";
import { criterios, faltantes, type Pesos, type Resultado } from "./_motor";
import { confirmar } from "./acciones";

const abreviado: Record<keyof Pesos, string> = { habilidades: "Hab.", complementariedad: "Comp.", intereses: "Int.", formacion: "Form.", disponibilidad: "Disp.", equilibrio: "Equil." };
const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}`);

export default async function Matching({ searchParams }: PageProps<"/austral/matching">) {
  await requireRol(); // solo admin
  const { vista, q, ok, error } = await searchParams;
  const datos = await cargarMatching(await createClient());
  const porAlumno = vista === "alumnos";
  const busqueda = typeof q === "string" ? q.trim().toLowerCase() : "";
  const coincide = (r: Resultado) => !busqueda || r.alumno.nombre.toLowerCase().includes(busqueda) || r.proyecto.nombre.toLowerCase().includes(busqueda);
  const enlace = (r: Resultado) => `/austral/matching/recomendacion/${r.alumno.id}/${r.proyecto.id}`;
  const propuestas = datos.decisiones.filter((d) => d.estado === "aceptada");
  const nombreAlumno = new Map(datos.sinGrupo.map((a) => [a.id, a.nombre]));
  const nombreProyecto = new Map(datos.todosLosProyectos.map((p) => [p.id, p.nombre]));
  const volver = `/austral/matching${porAlumno ? "?vista=alumnos" : ""}`;

  const estadoDe = (r: Resultado) => {
    const d = datos.decisionDe(r.alumno.id, r.proyecto.id);
    if (d && d.estado !== "pendiente") return <Badge variant={claseEstado[d.estado].variante}>{claseEstado[d.estado].texto}</Badge>;
    if (datos.plan.has(`${r.alumno.id}:${r.proyecto.id}`)) return <Badge>Sugerido</Badge>;
    if (r.puntaje < datos.config.puntaje_minimo) return <span className="text-xs text-[#666]">Bajo el mínimo</span>;
    return d ? <Badge variant="secondary">Pendiente</Badge> : null;
  };

  const indicadores = [
    { valor: datos.libres.length, texto: "alumnos sin grupo para recomendar" },
    { valor: datos.buscando.length, texto: "proyectos buscando integrantes" },
    { valor: propuestas.length, texto: "propuestas para confirmar" },
    { valor: datos.alertas.length, texto: "alertas para revisar" },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <Encabezado
        titulo="Recomendaciones"
        descripcion={`El agente compara a cada alumno sin grupo con cada proyecto que busca integrantes y prioriza a quien más le suma al equipo. Nunca asigna solo: aceptar crea una propuesta y la asignación se hace al confirmarla. Puntaje mínimo actual: ${datos.config.puntaje_minimo}.`}
        actual="/austral/matching"
        ok={ok}
        error={error}
      />

      <div className="mt-6 grid grid-cols-2 border-t border-l sm:grid-cols-4">
        {indicadores.map((i) => (
          <div key={i.texto} className="border-r border-b p-4">
            <div className="font-serif text-2xl">{i.valor}</div>
            <div className="text-sm text-[#666]">{i.texto}</div>
          </div>
        ))}
      </div>

      {propuestas.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-serif text-xl">Propuestas para confirmar</h2>
          <Table>
            <TableHeader><TableRow><TableHead>Alumno</TableHead><TableHead>Proyecto</TableHead><TableHead>Puntaje</TableHead><TableHead>Observaciones</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {propuestas.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{nombreAlumno.get(d.persona_id) ?? "—"}</TableCell>
                  <TableCell>{nombreProyecto.get(d.proyecto_id) ?? "—"}</TableCell>
                  <TableCell>{d.puntaje ?? "—"}</TableCell>
                  <TableCell className="max-w-xs text-[#666]">{d.observaciones ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-3">
                      <Link href={`/austral/matching/recomendacion/${d.persona_id}/${d.proyecto_id}`} className="text-sm underline underline-offset-4">Ver</Link>
                      <form action={confirmar}>
                        <input type="hidden" name="recomendacion_id" value={d.id} />
                        <input type="hidden" name="volver" value={volver} />
                        <BotonEnviar enviando="Confirmando…">Confirmar asignación</BotonEnviar>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      {datos.alertas.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-serif text-xl">Alertas</h2>
          <ul className="divide-y border">
            {datos.alertas.map((a, i) => (
              <li key={i} className="grid gap-1 p-4 text-sm sm:grid-cols-[1fr_auto]">
                <div>
                  <div className="font-medium">{a.titulo}</div>
                  <div className="text-[#666]">{a.detalle}</div>
                  <div className="mt-1">Sugerencia: {a.accion}</div>
                </div>
                <div className="flex items-start gap-3">
                  {a.alumnoId && <Link href={`/austral/matching/alumnos/${a.alumnoId}`} className="underline underline-offset-4">Ver alumno</Link>}
                  {a.proyectoId && <Link href={`/austral/matching/proyectos/${a.proyectoId}`} className="underline underline-offset-4">Ver proyecto</Link>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-10 mb-4 flex flex-wrap items-center gap-4">
        <div className="flex gap-4 text-sm">
          <Link href="/austral/matching" className={porAlumno ? "text-[#666] hover:text-primary" : "underline underline-offset-4"}>Ranking por proyecto</Link>
          <Link href="/austral/matching?vista=alumnos" className={porAlumno ? "underline underline-offset-4" : "text-[#666] hover:text-primary"}>Ranking por alumno</Link>
        </div>
        <form className="ml-auto flex items-center gap-2">
          {porAlumno && <input type="hidden" name="vista" value="alumnos" />}
          <input name="q" defaultValue={busqueda} placeholder="Buscar alumno o proyecto" className={`${selectClase} w-56`} />
          <Button type="submit" variant="outline" size="sm">Buscar</Button>
        </form>
      </div>

      {datos.buscando.length === 0 || datos.libres.length === 0 ? (
        <div className="border p-10 text-center text-sm text-[#666]">
          {datos.buscando.length === 0
            ? "No hay proyectos buscando integrantes. Cargá sus necesidades en Proyectos (estado \"Buscando integrantes\")."
            : "No quedan alumnos sin grupo para recomendar."}
        </div>
      ) : !porAlumno ? (
        datos.buscando.map((p) => {
          const ranking = datos.resultados.filter((r) => r.proyecto.id === p.id && coincide(r)).sort((x, y) => y.puntaje - x.puntaje);
          const falta = faltantes(p);
          return (
            <section key={p.id} className="mb-10">
              <h2 className="font-serif text-xl">{p.nombre}</h2>
              <p className="mt-1 mb-3 text-sm text-[#666]">
                {p.vacantes} lugar{p.vacantes === 1 ? "" : "es"} libre{p.vacantes === 1 ? "" : "s"} · {p.integrantes.length} integrante{p.integrantes.length === 1 ? "" : "s"}
                {falta.length ? ` · le falta: ${falta.map((h) => h.nombre).join(", ")}` : " · ya cubre lo que busca"}
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidato</TableHead><TableHead>Compat.</TableHead><TableHead>Principal aporte</TableHead><TableHead>Cubre</TableHead>
                    {(Object.keys(criterios) as (keyof Pesos)[]).map((k) => <TableHead key={k} title={criterios[k]} className="text-right">{abreviado[k]}</TableHead>)}
                    <TableHead /><TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranking.map((r) => (
                    <TableRow key={r.alumno.id}>
                      <TableCell>{r.alumno.nombre}{r.alertas.length > 0 && <span className="text-destructive" title={r.alertas.join(" ")}> ⚠</span>}</TableCell>
                      <TableCell className="font-serif text-lg">{r.puntaje}%</TableCell>
                      <TableCell>{r.aporte ?? "—"}</TableCell>
                      <TableCell className="text-[#666]">{r.cubre.map((h) => h.nombre).join(", ") || "—"}</TableCell>
                      {(Object.keys(criterios) as (keyof Pesos)[]).map((k) => <TableCell key={k} className="text-right text-[#666]">{pct(r.valores[k])}</TableCell>)}
                      <TableCell>{estadoDe(r)}</TableCell>
                      <TableCell className="text-right"><Link href={enlace(r)} className="text-sm underline underline-offset-4">Ver</Link></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          );
        })
      ) : (
        datos.libres.filter((a) => !busqueda || a.nombre.toLowerCase().includes(busqueda)).map((a) => {
          const ranking = datos.resultados.filter((r) => r.alumno.id === a.id).sort((x, y) => y.puntaje - x.puntaje);
          return (
            <section key={a.id} className="mb-10">
              <h2 className="font-serif text-xl">{a.nombre}</h2>
              <p className="mt-1 mb-3 text-sm text-[#666]">
                {a.carrera ?? "Sin carrera"} · {a.habilidades.map((h) => h.nombre).join(", ") || "sin habilidades cargadas"}
              </p>
              <Table>
                <TableHeader><TableRow><TableHead>Proyecto</TableHead><TableHead>Compat.</TableHead><TableHead>Principal aporte</TableHead><TableHead>Necesidades que cubre</TableHead><TableHead>Alertas</TableHead><TableHead /><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {ranking.map((r) => (
                    <TableRow key={r.proyecto.id}>
                      <TableCell>{r.proyecto.nombre}</TableCell>
                      <TableCell className="font-serif text-lg">{r.puntaje}%</TableCell>
                      <TableCell>{r.aporte ?? "—"}</TableCell>
                      <TableCell className="text-[#666]">{r.cubre.map((h) => h.nombre).join(", ") || "—"}</TableCell>
                      <TableCell className="max-w-xs text-xs text-destructive">{r.alertas.join(" ")}</TableCell>
                      <TableCell>{estadoDe(r)}</TableCell>
                      <TableCell className="text-right"><Link href={enlace(r)} className="text-sm underline underline-offset-4">Ver</Link></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          );
        })
      )}
      <p className="text-xs text-[#666]">
        &quot;Sugerido&quot; es el reparto que propone el agente: de mayor a menor puntaje, cada alumno en un solo proyecto y sin pasarse de los lugares libres.
        Columnas: puntaje de cada criterio sobre 100 (— = falta información).
      </p>
    </div>
  );
}
