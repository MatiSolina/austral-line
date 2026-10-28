import { requireRol } from "@/lib/auth";

// Alumnos y jurados entran solo a la preparación de jurados ("Documentos del proyecto" y "Preparación").
// Cada página de esta carpeta verifica además su propio rol (requireRol() para el admin, requireRol("alumno")
// o requireRol("jurado")): una página nueva tiene que hacerlo también.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireRol("alumno", "jurado");
  return children;
}
