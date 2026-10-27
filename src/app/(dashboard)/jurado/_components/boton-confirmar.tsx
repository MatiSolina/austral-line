"use client";
// GRUPO JURADO — botón de envío que pide confirmación antes (borrar un salón, publicar devoluciones, etc.).
import { Button } from "@/components/ui/button";

type Props = {
  mensaje: string;
  children: React.ReactNode;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "lg";
  disabled?: boolean;
  className?: string;
};

export function BotonConfirmar({ mensaje, children, variant = "ghost", size = "sm", disabled, className }: Props) {
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      disabled={disabled}
      className={className ?? (variant === "ghost" ? "text-[#666] hover:text-destructive" : undefined)}
      onClick={(e) => { if (!confirm(mensaje)) e.preventDefault(); }}
    >
      {children}
    </Button>
  );
}
