import { requireRol } from "@/lib/auth";

// Los alumnos entran solo para contestar "Mi feedback". Cada página de esta carpeta verifica además su propio rol
// (requireRol("mentor"), requireRol() para el admin o requireRol("mentor", "alumno")): una página nueva tiene que hacerlo también.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireRol("mentor", "alumno");
  return children;
}
