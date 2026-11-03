// GRUPO AUSTRAL — importación de perfiles de matching desde un CSV (o un Excel guardado como CSV).
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Encabezado } from "../_components/encabezado";
import { columnas } from "../_csv";
import { Importador } from "./importador";

export default async function Importar() {
  await requireRol(); // solo admin
  const supabase = await createClient();
  const [catalogo, alumnos] = await Promise.all([
    supabase.from("austral_habilidades").select("id, nombre").order("orden"),
    supabase.from("personas_contacto").select("id, nombre, email").eq("rol", "alumno"),
  ]);
  if (catalogo.error) throw catalogo.error;
  if (alumnos.error) throw alumnos.error;

  return (
    <div className="mx-auto max-w-6xl">
      <Encabezado
        titulo="Importar perfiles"
        descripcion="Cargá los datos de matching de muchos alumnos a la vez. Los alumnos tienen que existir en la app (se suman desde Miembros); se reconocen por su email."
        actual="/austral/matching/importar"
      />
      <section className="mt-6 border p-5 text-sm">
        <h2 className="mb-2 font-medium">Formato</h2>
        <p>Primera fila con los encabezados. Separador punto y coma (como guarda Excel en español) o coma. Columnas: <code>{columnas.join(", ")}</code>.</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[#666]">
          <li><b>disponibilidad</b>: mañana, tarde, noche o fin de semana, separadas con <code>|</code>.</li>
          <li><b>modalidad</b>: presencial, remota o mixta.</li>
          <li><b>habilidades</b>: <code>Habilidad:nivel</code> separadas con <code>|</code>, por ejemplo <code>UX/UI:avanzado|Marketing:intermedio</code>. Si viene, reemplaza todas las habilidades del alumno.</li>
          <li>Una celda vacía no cambia ese dato. Las filas con errores no se cargan.</li>
        </ul>
        <p className="mt-2 text-[#666]">Habilidades válidas: {catalogo.data.map((h) => h.nombre).join(", ")}.</p>
      </section>
      <div className="mt-6">
        <Importador catalogo={catalogo.data} alumnos={alumnos.data.filter((a): a is { id: string; nombre: string; email: string } => !!a.id && !!a.email)} />
      </div>
    </div>
  );
}
