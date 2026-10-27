// GRUPO AUSTRAL — esta carpeta es de ustedes.
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function Austral() {
  await requireRol();
  const supabase = await createClient();
  const { data: eventos, error } = await supabase.from("eventos").select("*").order("inicio");
  if (error) throw error;

  return (
    <>
      <h1 className="mb-6 font-serif text-2xl">Eventos</h1>
      <Table>
        <TableHeader>
          <TableRow><TableHead>Evento</TableHead><TableHead>Tipo</TableHead><TableHead>Fecha</TableHead><TableHead>Lugar</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {eventos.map((e) => (
            <TableRow key={e.id}>
              <TableCell>{e.nombre}</TableCell>
              <TableCell>{e.tipo}</TableCell>
              <TableCell>{new Date(e.inicio).toLocaleString("es-AR")}</TableCell>
              <TableCell>{e.lugar}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
