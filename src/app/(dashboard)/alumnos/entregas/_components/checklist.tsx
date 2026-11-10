"use client";

// GRUPO ALUMNOS — checklist de una entrega. El alumno marca cada requisito (se guarda al tocarlo);
// profesores y mentor lo ven sin poder cambiarlo. No bloquea la subida: solo avisa lo que falta.
import { useRef } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { marcarRequisito } from "../_acciones";

export type Requisito = { id: string; texto: string; obligatorio: boolean; marcadoPor: string | null };

function Fila(props: { r: Requisito; puedeMarcar: boolean; proyectoId: string; eventoId: string; individual: boolean }) {
  const form = useRef<HTMLFormElement>(null);
  const { r } = props;
  const id = `req-${r.id}-${props.individual ? "i" : "g"}`;
  return (
    <li>
      <form ref={form} action={marcarRequisito} className="flex items-start gap-2.5">
        <input type="hidden" name="item_id" value={r.id} />
        <input type="hidden" name="proyecto_id" value={props.proyectoId} />
        <input type="hidden" name="evento_id" value={props.eventoId} />
        <input type="hidden" name="individual" value={props.individual ? "1" : "0"} />
        <input type="hidden" name="marcar" value={r.marcadoPor ? "0" : "1"} />
        <input
          id={id}
          type="checkbox"
          checked={!!r.marcadoPor}
          disabled={!props.puedeMarcar}
          onChange={() => form.current?.requestSubmit()}
          className="mt-0.5 size-4 shrink-0 accent-primary"
        />
        <label htmlFor={id} className={cn("grid gap-0.5", props.puedeMarcar && "cursor-pointer")}>
          <span>
            {r.texto}
            {!r.obligatorio && <span className="text-[#666]"> (opcional)</span>}
          </span>
          {r.marcadoPor && <span className="text-xs text-[#666]">Marcado por {r.marcadoPor}</span>}
        </label>
      </form>
    </li>
  );
}

export function Checklist(props: { requisitos: Requisito[]; puedeMarcar: boolean; proyectoId: string; eventoId: string; individual: boolean }) {
  if (props.requisitos.length === 0) return null;
  const faltan = props.requisitos.filter((r) => r.obligatorio && !r.marcadoPor).length;
  return (
    <div className="grid gap-3 border bg-card p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">Checklist de la entrega</span>
        <span className={cn("ml-auto inline-flex items-center gap-1 text-xs", faltan ? "text-destructive" : "text-[#666]")}>
          {faltan ? <CircleAlert className="size-3.5" aria-hidden /> : <CircleCheck className="size-3.5" aria-hidden />}
          {faltan
            ? `${faltan === 1 ? "Falta 1 requisito obligatorio" : `Faltan ${faltan} requisitos obligatorios`}${props.puedeMarcar ? ": revísenlo antes de subir." : "."}`
            : "Todos los obligatorios marcados."}
        </span>
      </div>
      <ul className="grid gap-2">
        {props.requisitos.map((r) => (
          <Fila key={r.id} r={r} puedeMarcar={props.puedeMarcar} proyectoId={props.proyectoId} eventoId={props.eventoId} individual={props.individual} />
        ))}
      </ul>
    </div>
  );
}
