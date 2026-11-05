// GRUPO AUSTRAL — proyectos y sus necesidades: cuántos integrantes buscan, qué habilidades ya cubren y cuáles les faltan.
import Link from "next/link";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Encabezado, selectClase } from "../_components/encabezado";
import { cargarMatching, estadosBusqueda } from "../_datos";
import { cubiertas, faltantes } from "../_motor";

export default async function Proyectos({ searchParams }: PageProps<"/austral/matching/proyectos">) {
  await requireRol(); // solo admin
  const { estado, ok, error } = await searchParams;
  const datos = await cargarMatching(await createClient());
  const filtro = typeof estado === "string" ? estado : "";
  const filas = datos.todosLosProyectos.filter((p) => !filtro || (filtro === "sin_cargar" ? !p.necesidad : p.necesidad?.estado === filtro));

  return (
    <div className="mx-auto max-w-6xl">
      <Encabezado
        titulo="Proyectos"
        descripcion="Qué necesita cada equipo. Las habilidades cubiertas salen de los perfiles de sus integrantes (nivel intermedio o avanzado)."
        actual="/austral/matching/proyectos"
        ok={ok}
        error={error}
      />

      <form className="mt-6 mb-6 flex items-center gap-2">
        <select name="estado" defaultValue={filtro} className={selectClase}>
          <option value="">Todos</option>
          {Object.entries(estadosBusqueda).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          <option value="sin_cargar">Sin necesidades cargadas</option>
        </select>
        <Button type="submit" variant="outline" size="sm">Filtrar</Button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Proyecto</TableHead><TableHead>Integrantes</TableHead><TableHead>Ya cubre</TableHead>
            <TableHead>Le falta</TableHead><TableHead>Búsqueda</TableHead><TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map((p) => {
            const ya = cubiertas(p.proyecto);
            const falta = faltantes(p.proyecto);
            return (
              <TableRow key={p.id}>
                <TableCell>
                  <div>{p.nombre}</div>
                  {p.descripcion && <div className="text-xs text-[#666]">{p.descripcion}</div>}
                </TableCell>
                <TableCell className="text-[#666]">
                  {p.proyecto.integrantes.length}{p.necesidad ? ` de ${p.necesidad.integrantes_necesarios}` : ""}
                  {p.propuestos ? ` · ${p.propuestos} propuesto${p.propuestos === 1 ? "" : "s"}` : ""}
                </TableCell>
                <TableCell>
                  <div className="flex max-w-xs flex-wrap gap-1">
                    {p.proyecto.buscadas.filter((h) => ya.has(h.id)).map((h) => <Badge key={h.id} variant="secondary">{h.nombre}</Badge>)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex max-w-xs flex-wrap gap-1">
                    {falta.map((h) => <Badge key={h.id} variant="outline">{h.nombre}</Badge>)}
                    {p.necesidad && !p.proyecto.buscadas.length && <span className="text-sm text-destructive">Sin habilidades buscadas</span>}
                  </div>
                </TableCell>
                <TableCell>
                  {p.necesidad ? <Badge variant={p.necesidad.estado === "buscando" ? "default" : "outline"}>{estadosBusqueda[p.necesidad.estado]}</Badge> : <span className="text-sm text-[#666]">Sin cargar</span>}
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/austral/matching/proyectos/${p.id}`} className="text-sm underline underline-offset-4">{p.necesidad ? "Editar" : "Cargar necesidades"}</Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <p className="mt-4 text-xs text-[#666]">Los proyectos los crea el grupo Alumnos y el admin; acá se cargan sus necesidades para el matching.</p>
    </div>
  );
}
