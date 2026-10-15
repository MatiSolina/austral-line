"use client";
// GRUPO JURADO — botón de envío que pide confirmación antes (por ejemplo, para borrar un salón).
import { Button } from "@/components/ui/button";

export function BotonConfirmar({ mensaje, children }: { mensaje: string; children: React.ReactNode }) {
  return (
    <Button
      type="submit"
      variant="ghost"
      size="sm"
      className="text-[#666] hover:text-destructive"
      onClick={(e) => { if (!confirm(mensaje)) e.preventDefault(); }}
    >
      {children}
    </Button>
  );
}
