"use client";

// GRUPO ALUMNOS — pestañas de la sección, al estilo de las tabs de Midday.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const pestanas = [
  { href: "/alumnos", label: "Proyectos" },
  { href: "/alumnos/perfil", label: "Mi perfil" },
  { href: "/alumnos/afines", label: "Compañeros afines" },
];

export function SubNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-8 flex gap-6 overflow-x-auto border-b">
      {pestanas.map(({ href, label }) => {
        const activa = pathname === href;
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
