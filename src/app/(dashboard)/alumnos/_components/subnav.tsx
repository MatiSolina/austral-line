"use client";

// GRUPO ALUMNOS — pestañas de la sección, al estilo de las tabs de Midday.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const pestanas = [
  { href: "/alumnos", label: "Proyectos" },
  { href: "/alumnos/perfil", label: "Mi perfil" },
  { href: "/alumnos/afines", label: "Compañeros afines" },
  { href: "/alumnos/ideas", label: "Banco de ideas" },
  { href: "/alumnos/hitos", label: "Próximos hitos" },
  { href: "/alumnos/entregas", label: "Entregas" },
];

// Solo la ven los profesores (rol admin).
const pestanaProfesores = { href: "/alumnos/panel", label: "Panel de profesores" };

// Los mentores solo usan Entregas (ven las de sus grupos y dejan devoluciones).
export function SubNav({ esProfesor = false, soloEntregas = false }: { esProfesor?: boolean; soloEntregas?: boolean }) {
  const pathname = usePathname();
  const visibles = soloEntregas
    ? pestanas.filter((p) => p.href === "/alumnos/entregas")
    : esProfesor
      ? [...pestanas, pestanaProfesores]
      : pestanas;
  return (
    <nav className="mb-8 flex gap-6 overflow-x-auto border-b">
      {visibles.map(({ href, label }) => {
        const activa = href === "/alumnos" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "-mb-px whitespace-nowrap border-b pb-3 text-sm text-[#666] hover:text-primary",
              activa ? "border-primary text-primary" : "border-transparent",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
