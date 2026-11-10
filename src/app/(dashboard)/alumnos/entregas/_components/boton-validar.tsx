"use client";

// GRUPO ALUMNOS — botón "Validar con IA" que avisa mientras la IA revisa el archivo.
import { useFormStatus } from "react-dom";
import { ScanSearch } from "lucide-react";

export function BotonValidar({ texto }: { texto: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex items-center gap-1 text-[#666] hover:text-primary disabled:opacity-60">
      <ScanSearch className="size-3.5" aria-hidden /> {pending ? "Revisando el archivo… (tarda hasta un minuto)" : texto}
    </button>
  );
}
