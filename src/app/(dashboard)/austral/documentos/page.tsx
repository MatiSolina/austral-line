// GRUPO AUSTRAL — "Documentos del proyecto": cada equipo sube acá las fichas y entregas de su proyecto, clase a clase.
// Con eso el agente de preparación arma el material que leen los jurados antes de la presentación (solo el problema).
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BotonConfirmar } from "../_components/boton-confirmar";
import { fechaHora, tamano } from "../_preparacion";
import { borrarDocumento } from "./acciones";
import { Subir } from "./subir";

export default async function Documentos() {
  const persona = await requireRol("alumno");
  const encabezado = (
    <>
      <h1 className="font-serif text-2xl">Documentos del proyecto</h1>
      <p className="mt-1 mb-8 text-sm text-[#666]">
        Subí las fichas y entregas de tu proyecto (PDF, .txt o .md, hasta 10 MB). Con esto se prepara a los jurados
        para que lleguen entendiendo el problema que abordan; la solución la cuentan ustedes el día de la presentación.
      </p>
    </>
  );
  if (persona.rol === "admin") {
    return (
      <div className="mx-auto max-w-3xl">
        {encabezado}
        <div className="border p-10 text-center text-sm text-[#666]">
          Esta es la pantalla de los alumnos: cada uno sube acá los documentos de su equipo. Los de todos los proyectos se ven en Austral → Preparación de jurados.
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: proyectos, error } = await supabase
    .from("proyecto_integrantes")
    .select("proyectos(id, nombre, austral_documentos(id, nombre, bytes, created_at, personas(nombre)))")
    .eq("persona_id", persona.id);
  if (error) throw error;

  return (
    <div className="mx-auto max-w-3xl">
      {encabezado}
      {proyectos.length === 0 && (
        <div className="border p-10 text-center text-sm text-[#666]">
          Todavía no estás en ningún proyecto. Cuando el admin te sume a tu equipo, vas a poder subir sus documentos acá.
        </div>
      )}
      {proyectos.map(({ proyectos: p }) => {
        const documentos = [...p.austral_documentos].sort((a, b) => b.created_at.localeCompare(a.created_at));
        return (
          <section key={p.id} className="mb-10">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="font-serif text-xl">{p.nombre}</h2>
              <Subir proyectoId={p.id} />
            </div>
            {documentos.length === 0 ? (
              <div className="border p-8 text-center text-sm text-[#666]">Todavía no subieron documentos.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Documento</TableHead><TableHead>Subido</TableHead><TableHead>Tamaño</TableHead><TableHead /></TableRow>
                </TableHeader>
                <TableBody>
                  {documentos.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{d.nombre}</TableCell>
                      <TableCell className="text-[#666]">{fechaHora(d.created_at)}{d.personas ? ` · ${d.personas.nombre}` : ""}</TableCell>
                      <TableCell className="text-[#666]">{tamano(d.bytes)}</TableCell>
                      <TableCell className="text-right">
                        <form action={borrarDocumento}>
                          <input type="hidden" name="documento_id" value={d.id} />
                          <BotonConfirmar mensaje={`¿Borrar "${d.nombre}"?`}>Borrar</BotonConfirmar>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        );
      })}
    </div>
  );
}
