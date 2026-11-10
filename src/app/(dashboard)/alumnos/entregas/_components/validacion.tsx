// GRUPO ALUMNOS — resultado de la última validación con IA de una versión, contra el checklist del hito.
import { CircleAlert, CircleCheck, CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ItemValidado, Veredicto } from "../_validador";

const ZONA = "America/Argentina/Buenos_Aires";
const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: ZONA });

const VEREDICTO: Record<Veredicto, { icono: typeof CircleCheck; texto: string; clase: string }> = {
  cumple: { icono: CircleCheck, texto: "Cumple", clase: "text-primary" },
  no_cumple: { icono: CircleAlert, texto: "No cumple", clase: "text-destructive" },
  no_se_puede_saber: { icono: CircleHelp, texto: "No se puede saber", clase: "text-[#666]" },
};

export type ValidacionGuardada = { created_at: string; resultado: { resumen?: string; items?: ItemValidado[] } };

export function ResultadoValidacion({ v }: { v: ValidacionGuardada }) {
  const items = v.resultado.items ?? [];
  const noCumple = items.filter((i) => i.veredicto === "no_cumple").length;
  return (
    <details className="border bg-background text-sm" open={noCumple > 0}>
      <summary className="cursor-pointer px-3 py-2">
        <span className="font-medium">Validación con IA</span>
        <span className={cn("ml-2", noCumple ? "text-destructive" : "text-[#666]")}>
          {noCumple ? `${noCumple} ${noCumple === 1 ? "requisito no cumple" : "requisitos no cumplen"}` : "Sin problemas detectados"}
        </span>
        <span className="text-xs text-[#666]"> · {fechaHora(v.created_at)}</span>
      </summary>
      <div className="grid gap-2 border-t px-3 py-3">
        {v.resultado.resumen && <p>{v.resultado.resumen}</p>}
        <ul className="grid gap-2">
          {items.map((i) => {
            const { icono: Icono, texto, clase } = VEREDICTO[i.veredicto] ?? VEREDICTO.no_se_puede_saber;
            return (
              <li key={i.item_id} className="flex items-start gap-2">
                <Icono className={cn("mt-0.5 size-4 shrink-0", clase)} aria-hidden />
                <span className="grid gap-0.5">
                  <span>
                    {i.texto}
                    {!i.obligatorio && <span className="text-[#666]"> (opcional)</span>}
                    <span className={cn("ml-2 text-xs", clase)}>{texto}</span>
                  </span>
                  <span className="text-xs text-[#666]">{i.detalle}</span>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-[#666]">Revisa solo el formato contra el checklist; no evalúa el contenido. Puede equivocarse: ante la duda, consulten a los profesores.</p>
      </div>
    </details>
  );
}
