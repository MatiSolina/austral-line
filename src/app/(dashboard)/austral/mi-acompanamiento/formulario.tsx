"use client";

import { useActionState } from "react";
import { guardarExperiencia, type Resultado } from "./actions";

export function FormularioExperiencia({ proyectoId, anterior }: {
  proyectoId: string; anterior?: { puntaje: number; comentario: string };
}) {
  const [estado, accion, pendiente] = useActionState<Resultado, FormData>(guardarExperiencia, { ok: true, mensaje: "" });
  return <form action={accion} className="max-w-xl space-y-4 border-t pt-4 text-sm">
    <input type="hidden" name="proyecto_id" value={proyectoId} />
    <label className="block">¿Cómo te está ayudando el acompañamiento de mentores?
      <select className="mt-1 block w-full border bg-background px-3 py-2" name="puntaje" defaultValue={anterior?.puntaje ?? 3}>
        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} de 5</option>)}
      </select>
    </label>
    <label className="block">¿Qué necesitaría tu equipo? (opcional)
      <textarea className="mt-1 min-h-24 w-full border bg-background p-3" name="comentario" maxLength={500}
        defaultValue={anterior?.comentario ?? ""} placeholder="Ej. Una consulta breve sobre regulación." />
    </label>
    <p className="text-xs text-[#666]">Solo el equipo administrador ve tu respuesta. No cambia al mentor titular ni crea una asignación.</p>
    <div className="flex flex-wrap items-center gap-3">
      <button className="min-h-9 border border-foreground bg-foreground px-4 text-background disabled:opacity-50" disabled={pendiente}>
        {pendiente ? "Guardando…" : "Enviar opinión"}
      </button>
      {estado.mensaje && <p role="status" className={estado.ok ? "text-[#666]" : "text-destructive"}>{estado.mensaje}</p>}
    </div>
  </form>;
}
