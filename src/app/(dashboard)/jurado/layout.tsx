import { requireRol } from "@/lib/auth";

// Los alumnos entran solo para ver "Mi devolución". Cada página de esta carpeta verifica además su propio rol
// (requireRol("jurado"), requireRol() para el admin o requireRol("alumno")): una página nueva tiene que hacerlo también.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireRol("jurado", "alumno");
  return children;
}
