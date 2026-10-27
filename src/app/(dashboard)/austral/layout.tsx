import { requireRol } from "@/lib/auth";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireRol("alumno", "mentor");
  return children;
}
