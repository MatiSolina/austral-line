// GRUPO AUSTRAL — título, navegación entre las secciones del matching y mensajes de las acciones.
import Link from "next/link";

const secciones = [
  { href: "/austral/matching", texto: "Recomendaciones" },
  { href: "/austral/matching/alumnos", texto: "Alumnos sin grupo" },
  { href: "/austral/matching/proyectos", texto: "Proyectos" },
  { href: "/austral/matching/pesos", texto: "Ponderación" },
];

type Props = { titulo: string; descripcion?: string; actual: string; ok?: string | string[]; error?: string | string[] };

export function Encabezado({ titulo, descripcion, actual, ok, error }: Props) {
  return (
    <>
      <Link href="/austral" className="text-sm text-[#666] hover:text-primary">← Austral</Link>
      <nav className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-b text-sm">
        {secciones.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className={`-mb-px border-b-2 pb-2 ${s.href === actual ? "border-primary" : "border-transparent text-[#666] hover:text-primary"}`}
          >
            {s.texto}
          </Link>
        ))}
      </nav>
      <h1 className="mt-8 font-serif text-2xl">{titulo}</h1>
      {descripcion && <p className="mt-1 text-sm text-[#666]">{descripcion}</p>}
      {typeof ok === "string" && <p className="mt-6 border p-3 text-sm">{ok}</p>}
      {typeof error === "string" && <p className="mt-6 border border-destructive p-3 text-sm text-destructive">{error}</p>}
    </>
  );
}

export const selectClase = "h-9 border bg-background px-2 text-sm";
export const campoClase = "mt-1 w-full border bg-background p-2 text-sm";
