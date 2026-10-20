// GRUPO MENTORES — cada mentor completa su perfil. Nada es obligatorio: se va completando de a poco.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUsuario, requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { BotonEnviar } from "../_components/boton-enviar";

const texto = (formData: FormData, campo: string) => String(formData.get(campo) ?? "").trim() || null;

async function guardarPerfil(formData: FormData) {
  "use server";
  const persona = await requireRol("mentor");
  if (persona.rol !== "mentor") redirect("/mentores");
  const cupo = Number(formData.get("cupo_proyectos"));

  const supabase = await createClient();
  const { error } = await supabase.from("mentores_perfiles").upsert({
    persona_id: persona.id,
    formacion: texto(formData, "formacion"),
    especialidades: texto(formData, "especialidades"),
    industrias: texto(formData, "industrias"),
    experiencia: texto(formData, "experiencia"),
    cupo_proyectos: Number.isInteger(cupo) && cupo > 0 ? cupo : null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  revalidatePath("/mentores");
  redirect("/mentores/perfil?guardado=1");
}

const campos = [
  { name: "formacion", label: "Formación", ayuda: "Qué estudiaste: carrera, posgrados, cursos. Ej: Ingeniería Industrial (UTN), MBA.", filas: 2 },
  { name: "especialidades", label: "Especialidades", ayuda: "En qué podés ayudar. Ej: producto, finanzas, ventas, tecnología.", filas: 2 },
  { name: "industrias", label: "Industrias", ayuda: "Rubros que conocés. Ej: agro, educación, fintech, salud.", filas: 2 },
  { name: "experiencia", label: "Experiencia", ayuda: "Tu trayectoria, contada como quieras.", filas: 8 },
] as const;

export default async function MiPerfil({ searchParams }: PageProps<"/mentores/perfil">) {
  const { persona } = await getUsuario();
  if (persona?.rol !== "mentor") {
    return <p className="text-[#666]">Esta pantalla es para que cada mentor complete su propio perfil.</p>;
  }
  const supabase = await createClient();
  const { data: perfil, error } = await supabase
    .from("mentores_perfiles").select("*").eq("persona_id", persona.id).maybeSingle();
  if (error) throw error;
  const { guardado } = await searchParams;

  return (
    <>
      <h1 className="mb-2 font-serif text-2xl">Mi perfil de mentor</h1>
      <p className="mb-8 max-w-2xl text-sm text-[#666]">
        Nada es obligatorio. Completá lo que quieras y guardá cuando quieras: con esto el coordinador te sugiere los
        proyectos que mejor encajan con vos.
      </p>

      <form action={guardarPerfil} className="grid max-w-2xl gap-6 border bg-card p-6">
        {campos.map((c) => (
          <div key={c.name} className="grid gap-2">
            <Label htmlFor={c.name}>{c.label}</Label>
            <textarea
              id={c.name}
              name={c.name}
              rows={c.filas}
              defaultValue={perfil?.[c.name] ?? ""}
              className="border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring"
            />
            <p className="text-xs text-[#666]">{c.ayuda}</p>
          </div>
        ))}
        <div className="grid gap-2">
          <Label htmlFor="cupo_proyectos">Cupo de proyectos</Label>
          <Input
            id="cupo_proyectos"
            name="cupo_proyectos"
            type="number"
            min={1}
            defaultValue={perfil?.cupo_proyectos ?? ""}
            className="w-32"
          />
          <p className="text-xs text-[#666]">Cuántos proyectos podés acompañar como máximo. Vacío = sin límite.</p>
        </div>
        <div className="flex items-center gap-4">
          <BotonEnviar enviando="Guardando…">Guardar</BotonEnviar>
          {guardado && <span className="text-sm text-[#666]">Guardado ✓</span>}
        </div>
      </form>
    </>
  );
}
