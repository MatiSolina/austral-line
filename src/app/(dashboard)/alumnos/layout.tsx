import { requireRol } from "@/lib/auth";
import { SubNav } from "./_components/subnav";

export default async function Layout({ children }: { children: React.ReactNode }) {
  // Los mentores entran solo para ver las entregas de sus grupos y dejar devoluciones.
  const persona = await requireRol("alumno", "mentor");
  return (
    <>
      <SubNav esProfesor={persona.rol === "admin"} soloEntregas={persona.rol === "mentor"} />
      {children}
    </>
  );
}
