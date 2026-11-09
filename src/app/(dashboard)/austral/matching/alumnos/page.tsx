// GRUPO AUSTRAL — alumnos sin grupo (alumnos de la app que no son integrantes de ningún proyecto), con su perfil de matching.
import Link from "next/link";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Encabezado, selectClase } from "../_components/encabezado";
import { cargarMatching } from "../_datos";
import { categorias, franjas, niveles, type Categoria } from "../_motor";

export default async function Alumnos({ searchParams }: PageProps<"/austral/matching/alumnos">) {
  await requireRol(); // solo admin
  const { q, categoria, ok, error } = await searchParams;
  const datos = await cargarMatching(await createClient());
  const busqueda = typeof q === "string" ? q.trim().toLowerCase() : "";
  const filtro = typeof categoria === "string" && categoria in categorias ? (categoria as Categoria) : null;

  const filas = datos.sinGrupo
    .filter((a) => !busqueda || a.nombre.toLowerCase().includes(busqueda) || (a.carrera ?? "").toLowerCase().includes(busqueda))
    .filter((a) => !filtro || a.habilidades.some((h) => h.categoria === filtro));
  const nombreProyecto = new Map(datos.todosLosProyectos.map((p) => [p.id, p.nombre]));

  return (
    <div className="mx-auto max-w-6xl">
      <Encabezado
        titulo="Alumnos sin grupo"
        descripcion="Alumnos de la app que todavía no son integrantes de ningún proyecto. La carrera y los intereses los carga cada alumno en su perfil; acá se completan los datos para el matching."
        actual="/austral/matching/alumnos"
        ok={ok}
        error={error}
      />

      <form className="mt-6 mb-6 flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={busqueda} placeholder="Buscar por nombre o carrera" className={`${selectClase} w-64`} />
        <select name="categoria" defaultValue={filtro ?? ""} className={selectClase}>
          <option value="">Todas las habilidades</option>
          {Object.entries(categorias).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <Button type="submit" variant="outline" size="sm">Filtrar</Button>
        <span className="ml-auto text-sm text-[#666]">{filas.length} de {datos.sinGrupo.length} alumnos</span>
      </form>

      {filas.length === 0 ? (
        <div className="border p-10 text-center text-sm text-[#666]">No hay alumnos sin grupo{busqueda || filtro ? " con ese filtro" : ""}.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Alumno</TableHead><TableHead>Carrera · año</TableHead><TableHead>Habilidades</TableHead>
              <TableHead>Disponibilidad</TableHead><TableHead>Estado</TableHead><TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((a) => {
              const perfil = datos.perfilDe.get(a.id);
              const faltan = [!a.carrera && "carrera", !a.habilidades.length && "habilidades", !a.disponibilidad.length && "disponibilidad", !a.intereses.size && "intereses"].filter(Boolean);
              const propuesta = datos.conPropuesta.get(a.id);
              return (
                <TableRow key={a.id}>
                  <TableCell>{a.nombre}</TableCell>
                  <TableCell className="text-[#666]">{a.carrera ?? "—"}{perfil?.anio ? ` · ${perfil.anio}º año` : ""}</TableCell>
                  <TableCell>
                    <div className="flex max-w-sm flex-wrap gap-1">
                      {a.habilidades.length
                        ? a.habilidades.map((h) => <Badge key={h.id} variant="outline" title={`${categorias[h.categoria]} · ${niveles[h.nivel]}`}>{h.nombre} · {niveles[h.nivel][0]}</Badge>)
                        : <span className="text-sm text-[#666]">Sin cargar</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-[#666]">{a.disponibilidad.map((f) => franjas[f]).join(", ") || "—"}</TableCell>
                  <TableCell>
                    {propuesta
                      ? <Badge variant="outline">Propuesto a {nombreProyecto.get(propuesta)}</Badge>
                      : faltan.length ? <span className="text-sm text-destructive">Falta {faltan.join(", ")}</span> : <span className="text-sm text-[#666]">Completo</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/austral/matching/alumnos/${a.id}`} className="text-sm underline underline-offset-4">Editar</Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      <p className="mt-4 text-xs text-[#666]">Niveles: B = básico, I = intermedio, A = avanzado. Para sumar alumnos nuevos a la app se usa Miembros.</p>
    </div>
  );
}
