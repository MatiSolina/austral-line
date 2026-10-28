// GRUPO AUSTRAL — esta carpeta es de ustedes.
import Link from "next/link";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function Austral() {
  await requireRol(); // solo admin
  const supabase = await createClient();
  const { data: eventos, error } = await supabase.from("eventos").select("*").order("inicio");
  if (error) throw error;

  return (
    <>
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h1 className="font-serif text-2xl">Eventos</h1>
        <Link href="/austral/preparacion" className="text-sm underline underline-offset-4">Preparación de jurados</Link>
      </div>
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
