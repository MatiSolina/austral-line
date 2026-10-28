// GRUPO MENTORES — esta carpeta es de ustedes.
import Link from "next/link";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { urlBase } from "./reuniones/agente";
import { pedirFeedback } from "./feedback/agente";

export default async function Mentores() {
  const persona = await requireRol("mentor");
  const supabase = await createClient();
  // Al entrar, el asistente pide el feedback de las reuniones que ya terminaron.
  await pedirFeedback(supabase, await urlBase());
  const { data: personas, error } = await supabase
    .from("personas")
    .select("id, nombre, email")
    .eq("rol", "mentor")
    .order("nombre");
  if (error) throw error;

  const enlace = "text-sm text-[#666] underline underline-offset-4 hover:text-primary";
  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-serif text-2xl">Mentores</h1>
        <div className="flex flex-wrap gap-6">
          <Link href="/mentores/reuniones" className={enlace}>Reuniones y resúmenes pre-reunión</Link>
          {persona.rol === "admin"
            ? <Link href="/mentores/feedback" className={enlace}>Feedback de reuniones</Link>
            : <Link href="/mentores/mi-feedback" className={enlace}>Mi feedback</Link>}
        </div>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Email</TableHead></TableRow></TableHeader>
        <TableBody>
          {personas.map((p) => (
            <TableRow key={p.id}><TableCell>{p.nombre}</TableCell><TableCell>{p.email}</TableCell></TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
