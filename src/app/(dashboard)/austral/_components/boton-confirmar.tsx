"use client";
// GRUPO AUSTRAL — botón de envío que pide confirmación antes (borrar un documento, volver un material a borrador).
import { Button } from "@/components/ui/button";

type Props = {
  mensaje: string;
  children: React.ReactNode;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "lg";
};

export function BotonConfirmar({ mensaje, children, variant = "ghost", size = "sm" }: Props) {
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={variant === "ghost" ? "text-[#666] hover:text-destructive" : undefined}
      onClick={(e) => { if (!confirm(mensaje)) e.preventDefault(); }}
    >
      {children}
    </Button>
  );
}
