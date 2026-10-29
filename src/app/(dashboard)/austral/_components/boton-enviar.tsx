"use client";
// GRUPO AUSTRAL — botón de envío que se deshabilita y cambia el texto mientras corre la acción (generar con IA tarda).
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type Props = {
  children: React.ReactNode;
  enviando: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "lg";
  name?: string;
  value?: string;
};

export function BotonEnviar({ children, enviando, variant = "default", size = "sm", name, value }: Props) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending} name={name} value={value}>
      {pending ? enviando : children}
    </Button>
  );
}
