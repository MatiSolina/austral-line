// GRUPO AUSTRAL — "Carga de la materia" (solo admin): carga masiva por CSV de los mentores, jurados, alumnos y proyectos
// del año. Crea o actualiza (por email o por nombre de proyecto); nunca borra a nadie.
import { requireRol } from "@/lib/auth";
import { Cargador } from "./cargador";

export default async function Carga() {
  await requireRol(); // solo admin
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-serif text-2xl">Carga de la materia</h1>
      <p className="mt-1 text-sm text-[#666]">
        Cargá de una vez a los mentores, jurados, alumnos y proyectos de este año. Cada carga es un CSV (separado con punto y coma o
        coma): descargá la plantilla, completala en Excel, guardala como CSV y subila. Antes de guardar vas a ver una vista previa
        con lo que se crea, lo que se actualiza y los errores. Las personas se reconocen por su email y los proyectos por su
        nombre: si ya existen, se actualizan.
      </p>
      <div className="mt-4 border p-4 text-sm">
        <p><b>Orden:</b> primero mentores, jurados y alumnos; después proyectos, porque sus participantes tienen que estar cargados como alumnos.</p>
        <p className="mt-2"><b>Usuarios para entrar:</b> esta carga no crea el usuario y contraseña de cada persona. Para que alguien pueda entrar a la app, el usuario se crea desde Miembros.</p>
        <p className="mt-2 text-[#666]">El teléfono y la especialidad quedan como datos internos del admin. El directorio que ven los alumnos sigue siendo el que cada mentor autoriza en Contactos de mentores.</p>
      </div>
      <div className="mt-6 grid gap-6">
        <Cargador tipo="mentores" />
        <Cargador tipo="jurados" />
        <Cargador tipo="alumnos" />
        <Cargador tipo="proyectos" />
      </div>
    </div>
  );
}
