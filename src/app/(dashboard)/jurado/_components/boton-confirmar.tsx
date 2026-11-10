"use client";
// GRUPO JURADO — botón de envío que pide confirmación antes (borrar un salón, publicar devoluciones, etc.).
// Con `enviando`, mientras corre la acción se deshabilita y muestra ese texto (regenerar con IA tarda).
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type Props = {
  mensaje: string;
  children: React.ReactNode;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "lg";
  disabled?: boolean;
  className?: string;
  enviando?: string;
};

export function BotonConfirmar({ mensaje, children, variant = "ghost", size = "sm", disabled, className, enviando }: Props) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      disabled={disabled || (!!enviando && pending)}
      className={className ?? (variant === "ghost" ? "text-[#666] hover:text-destructive" : undefined)}
      onClick={(e) => { if (!confirm(mensaje)) e.preventDefault(); }}
    >
      {enviando && pending ? enviando : children}
    </Button>
  );
}
