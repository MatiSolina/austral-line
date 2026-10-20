import { CalendarDays, Gavel, GraduationCap, Handshake, LayoutGrid, Lightbulb, Users } from "lucide-react";
import type { Database } from "@/lib/database.types";

export type Rol = Database["public"]["Enums"]["rol"];

// El orden es el del selector en Miembros: alumno primero para no crear admins sin querer.
export const roles: Record<Rol, string> = {
  alumno: "Alumno",
  mentor: "Mentor",
  jurado: "Jurado",
  admin: "Administrador",
};

// Menú del dashboard. `roles` = quién ve la sección (el admin ve todo).
// Para agregar una sección: sumala acá y creá la carpeta en src/app/(dashboard)/
export const secciones = [
  { href: "/", label: "Inicio", icon: LayoutGrid, roles: ["alumno", "mentor", "jurado"] },
  { href: "/alumnos", label: "Alumnos y proyectos", icon: GraduationCap, roles: ["alumno"] },
  { href: "/mentores", label: "Mentores", icon: Handshake, roles: ["mentor"] },
  { href: "/jurado", label: "Jurado", icon: Gavel, roles: ["jurado"] },
  { href: "/austral", label: "Austral", icon: CalendarDays, roles: [] },
  { href: "/austral/incentivos", label: "Incentivos", icon: Lightbulb, roles: [] },
  { href: "/miembros", label: "Miembros", icon: Users, roles: [] },
] satisfies { href: string; label: string; icon: unknown; roles: Rol[] }[];

export const puedeVer = (rol: Rol | undefined, permitidos: Rol[]) =>
  rol === "admin" || (!!rol && permitidos.includes(rol));
