// GRUPO MENTORES — esta carpeta es de ustedes.
import Link from "next/link";
import { getUsuario } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function Mentores() {
  const { persona } = await getUsuario();
  const supabase = await createClient();
  // Cada mentor ve solo su perfil; el admin ve todos (lo controla la base).
  const [personas, perfiles, asignaciones] = await Promise.all([
    supabase.from("personas").select("id, nombre, email").eq("rol", "mentor").order("nombre"),
    supabase.from("mentores_perfiles").select("persona_id, especialidades, cupo_proyectos"),
    supabase.from("mentores_sugerencias").select("mentor_id").eq("estado", "aceptada"),
  ]);
  for (const r of [personas, perfiles, asignaciones]) if (r.error) throw r.error;
  const esAdmin = persona?.rol === "admin";

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-2xl">Mentores</h1>
        {persona?.rol === "mentor" && <Link href="/mentores/perfil" className={buttonVariants()}>Mi perfil</Link>}
        {esAdmin && <Link href="/mentores/match" className={buttonVariants()}>Match de proyectos</Link>}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead><TableHead>Email</TableHead><TableHead>Especialidades</TableHead>
            {esAdmin && <TableHead>Proyectos</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {personas.data!.map((p) => {
            const perfil = perfiles.data!.find((x) => x.persona_id === p.id);
            const proyectos = asignaciones.data!.filter((a) => a.mentor_id === p.id).length;
            return (
              <TableRow key={p.id}>
                <TableCell>{p.nombre}</TableCell>
                <TableCell>{p.email}</TableCell>
                <TableCell className="text-[#666]">{perfil?.especialidades || "—"}</TableCell>
                {esAdmin && <TableCell>{perfil?.cupo_proyectos ? `${proyectos} de ${perfil.cupo_proyectos}` : proyectos}</TableCell>}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
}
