"use client";

import { useActionState } from "react";
import { decidirSugerencia, designarTitular, quitarTitular, registrarNecesidades, type Resultado } from "../actions";

const inicial: Resultado = { ok: true, mensaje: "" };
const campo = "mt-1 w-full border bg-background px-3 py-2 text-sm outline-none focus:border-foreground";
const boton = "inline-flex min-h-9 items-center border border-foreground bg-foreground px-4 text-sm text-background disabled:opacity-50";

export function FormularioNecesidades({ proyectoId, actual }: {
  proyectoId: string;
  actual?: { etapa: string; sector: string; necesidades: string[]; contexto: string };
}) {
  const [estado, accion, pendiente] = useActionState(registrarNecesidades, inicial);
  return <form action={accion} className="grid max-w-3xl gap-4 border-t pt-4 sm:grid-cols-2">
    <input type="hidden" name="proyecto_id" value={proyectoId} />
    <label className="text-sm">Etapa del proyecto
      <select className={campo} name="etapa" defaultValue={actual?.etapa ?? "idea"}>
        <option value="idea">Idea</option><option value="prototipo">Prototipo</option>
        <option value="validacion">Validación</option><option value="crecimiento">Crecimiento</option>
      </select>
    </label>
    <label className="text-sm">Sector
      <input className={campo} name="sector" maxLength={100} defaultValue={actual?.sector ?? ""} placeholder="Ej. Agrotecnología" />
    </label>
    <label className="text-sm sm:col-span-2">Necesidades actuales
      <textarea className={`${campo} min-h-20`} name="necesidades" required defaultValue={actual?.necesidades.join(", ") ?? ""}
        placeholder="Ej. Regulación, Proveedores, Desarrollo técnico" />
      <span className="mt-1 block text-xs text-[#666]">Separalas con comas. Se comparan con las especialidades que cargaron los mentores.</span>
    </label>
    <label className="text-sm sm:col-span-2">Cambios y contexto de esta revisión
      <textarea className={`${campo} min-h-20`} name="contexto" maxLength={1200} defaultValue={actual?.contexto ?? ""}
        placeholder="¿Qué cambió desde la revisión anterior?" />
    </label>
    <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
      <button className={boton} disabled={pendiente}>{pendiente ? "Actualizando…" : "Guardar revisión y recalcular"}</button>
      {estado.mensaje && <p role="status" className={`text-sm ${estado.ok ? "text-[#666]" : "text-destructive"}`}>{estado.mensaje}</p>}
    </div>
  </form>;
}

export function FormularioTitular({ proyectoId, mentores, actualId }: {
  proyectoId: string; mentores: { id: string; nombre: string }[]; actualId?: string;
}) {
  const [estado, accion, pendiente] = useActionState(designarTitular, inicial);
  return <form action={accion} className="space-y-3 border-t pt-4 text-sm">
    <input type="hidden" name="proyecto_id" value={proyectoId} />
    <label className="block max-w-md">Mentor con vínculo formal
      <select className={campo} name="mentor_id" required defaultValue={actualId ?? ""}>
        <option value="" disabled>Seleccionar mentor</option>
        {mentores.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
      </select>
    </label>
    <label className="flex items-start gap-2">
      <input className="mt-1" type="checkbox" name="confirmado" required />
      Confirmo que este mentor ya fue designado formalmente como titular del proyecto.
    </label>
    <div className="flex flex-wrap items-center gap-3">
      <button className={boton} disabled={pendiente || mentores.length === 0}>{actualId ? "Cambiar titular" : "Registrar titular"}</button>
      {estado.mensaje && <p role="status" className={`text-sm ${estado.ok ? "text-[#666]" : "text-destructive"}`}>{estado.mensaje}</p>}
    </div>
  </form>;
}

export function FormularioQuitarTitular({ proyectoId }: { proyectoId: string }) {
  const [estado, accion, pendiente] = useActionState(quitarTitular, inicial);
  return <form action={accion} className="flex flex-wrap items-center gap-3 text-sm">
    <input type="hidden" name="proyecto_id" value={proyectoId} />
    <label className="flex items-center gap-2"><input type="checkbox" name="confirmado" required />Confirmo que quiero quitar al titular.</label>
    <button className="min-h-9 border px-3 disabled:opacity-50" disabled={pendiente}>Quitar titular</button>
    {estado.mensaje && <p role="status" className={estado.ok ? "text-[#666]" : "text-destructive"}>{estado.mensaje}</p>}
  </form>;
}

export function FormularioSugerencia({ proyectoId, revisionId, mentorId, estado }: {
  proyectoId: string; revisionId: string; mentorId: string; estado: "considerada" | "descartada";
}) {
  const [resultado, accion, pendiente] = useActionState(decidirSugerencia, inicial);
  return <form action={accion} className="space-y-1">
    <input type="hidden" name="proyecto_id" value={proyectoId} />
    <input type="hidden" name="revision_id" value={revisionId} />
    <input type="hidden" name="mentor_id" value={mentorId} />
    <input type="hidden" name="estado" value={estado} />
    <button className="inline-flex min-h-9 items-center border px-3 text-sm hover:bg-muted disabled:opacity-50" disabled={pendiente}>
      {pendiente ? "Guardando…" : estado === "considerada" ? "Considerar" : "Descartar"}
    </button>
    {resultado.mensaje && <p role="status" className={resultado.ok ? "text-[#666]" : "text-destructive"}>{resultado.mensaje}</p>}
  </form>;
}
