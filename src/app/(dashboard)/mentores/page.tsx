// GRUPO MENTORES — esta carpeta es de ustedes.
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { TriangleAlert } from "lucide-react";
import { getUsuario } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

async function marcarRevisado(formData: FormData) {
  "use server";
  const { persona } = await getUsuario();
  if (persona?.rol !== "admin") throw new Error("Solo el administrador revisa estas cargas.");
  const supabase = await createClient();
  const { error } = await supabase.from("mentores_perfil_eventos").update({ revisado: true }).eq("id", String(formData.get("evento_id")));
  if (error) throw error;
  revalidatePath("/mentores");
}

export default async function Mentores() {
  const { persona } = await getUsuario();
  if (persona?.rol === "admin") return <PanelAdmin />;

  const supabase = await createClient();
  const [{ data: personas, error }, { data: miPerfil }] = await Promise.all([
    supabase.from("personas").select("id, nombre, email").eq("rol", "mentor").order("nombre"),
    persona ? supabase.from("mentores_perfil").select("estado").eq("persona_id", persona.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (error) throw error;

  return (
    <>
      <h1 className="mb-6 font-serif text-2xl">Mentores</h1>

      {persona?.rol === "mentor" && (
        <Card className="mb-8 flex-row flex-wrap items-center justify-between gap-4 px-5">
          <div className="grid gap-1.5">
            <p className="text-sm text-[#666]">Tu perfil</p>
            <Badge variant={miPerfil?.estado === "publicado" ? "default" : "outline"} className="w-fit">
              {miPerfil?.estado === "publicado" ? "Publicado" : "Todavía no lo completaste"}
            </Badge>
          </div>
          <Link href="/mentores/perfil" className={buttonVariants({ size: "lg" })}>
            {miPerfil ? "Editar perfil" : "Cargar perfil"}
          </Link>
        </Card>
      )}

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

// Aislado en una función aparte porque la fecha actual es un dato impuro: no se puede llamar
// directo en el cuerpo de un componente (regla react-hooks/purity).
function haceMasDeUnaSemana(fechaIso: string) {
  return Date.now() - new Date(fechaIso).getTime() > 7 * 24 * 60 * 60 * 1000;
}

// El admin no carga perfiles (es de cada mentor): ve el estado de todos y lo que el agente
// marcó para revisar. Las métricas son las que pide la cátedra para este agente.
async function PanelAdmin() {
  const supabase = await createClient();

  const [{ data: mentores, error: errorMentores }, { data: eventosSpam, error: errorEventos }] = await Promise.all([
    supabase.from("personas").select("id, nombre, email, mentores_perfil(*)").eq("rol", "mentor").order("nombre"),
    supabase.from("mentores_perfil_eventos").select("id, persona_id, detalle, created_at").eq("tipo", "marcado_spam").eq("revisado", false).order("created_at"),
  ]);
  if (errorMentores) throw errorMentores;
  if (errorEventos) throw errorEventos;

  const { count: autocorrecciones, error: errorAutocorrecciones } = await supabase
    .from("mentores_perfil_eventos").select("id", { count: "exact", head: true }).eq("tipo", "correccion_ia");
  if (errorAutocorrecciones) throw errorAutocorrecciones;

  const perfiles = mentores.flatMap((m) => (m.mentores_perfil ? [m.mentores_perfil] : []));
  const publicados = perfiles.filter((p) => p.estado === "publicado");
  const sinCorreccionPosterior = publicados.filter((p) => p.ediciones_post_publicacion === 0);
  const horasPromedioCarga = publicados.length
    ? publicados.reduce((acc, p) => acc + (new Date(p.publicado_at!).getTime() - new Date(p.iniciado_at).getTime()), 0) /
      publicados.length / 1000 / 60 / 60
    : null;
  const abandonados = perfiles.filter((p) => p.estado === "borrador" && haceMasDeUnaSemana(p.updated_at));

  const nombrePorPersona = new Map(mentores.map((m) => [m.id, m.nombre]));

  return (
    <>
      <h1 className="mb-6 font-serif text-2xl">Mentores</h1>

      <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Perfiles publicados", valor: `${publicados.length} / ${mentores.length}` },
          { label: "Quedan bien sin corregir", valor: publicados.length ? `${Math.round((sinCorreccionPosterior.length / publicados.length) * 100)}%` : "—" },
          { label: "Tiempo prom. de carga", valor: horasPromedioCarga != null ? `${horasPromedioCarga.toFixed(1)} hs` : "—" },
          { label: "Borradores abandonados", valor: `${abandonados.length} / ${perfiles.length}` },
        ].map(({ label, valor }) => (
          <Card key={label}>
            <CardHeader><CardTitle className="text-sm font-normal text-[#666]">{label}</CardTitle></CardHeader>
            <CardContent className="font-serif text-2xl">{valor}</CardContent>
          </Card>
        ))}
      </div>

      {eventosSpam.length > 0 && (
        <div className="mb-10 border border-destructive/40 bg-destructive/5 p-5">
          <h2 className="mb-4 flex items-center gap-2 font-serif text-lg">
            <TriangleAlert className="size-5 text-destructive" /> Cargas para revisar
          </h2>
          <ul className="grid gap-3">
            {eventosSpam.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-4 text-sm">
                <span>
                  <strong>{nombrePorPersona.get(e.persona_id) ?? "Mentor"}</strong>
                  {": "}
                  {(e.detalle as { motivo?: string } | null)?.motivo ?? "El agente marcó esta carga como posible spam."}
                </span>
                <form action={marcarRevisado}>
                  <input type="hidden" name="evento_id" value={e.id} />
                  <button type="submit" className="shrink-0 text-[#666] hover:text-primary">Marcar revisado</button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow><TableHead>Nombre</TableHead><TableHead>Email</TableHead><TableHead>Perfil</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {mentores.map((m) => (
            <TableRow key={m.id}>
              <TableCell>{m.nombre}</TableCell>
              <TableCell>{m.email}</TableCell>
              <TableCell>
                <Badge variant={m.mentores_perfil?.estado === "publicado" ? "default" : "outline"}>
                  {m.mentores_perfil?.estado === "publicado" ? "Publicado" : m.mentores_perfil ? "Borrador" : "Sin empezar"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <p className="mt-6 text-sm text-[#666]">Autocorrecciones del agente hasta ahora: {autocorrecciones ?? 0}.</p>
    </>
  );
}
