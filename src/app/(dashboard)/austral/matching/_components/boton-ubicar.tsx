"use client";
// GRUPO AUSTRAL — botón "Ubicar" con confirmación en la misma fila (sin el cuadro confirm() del navegador, que
// algunos navegadores bloquean y entonces el formulario no se envía nunca).
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function BotonUbicar({ nombre }: { nombre: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const { pending } = useFormStatus();

  if (!confirmando) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={(e) => {
          // Si todavía no eligió proyecto, que el navegador lo marque en el desplegable.
          if (e.currentTarget.form?.reportValidity()) setConfirmando(true);
        }}
      >
        Ubicar
      </Button>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <Button type="submit" size="sm" disabled={pending} title={`Sumar a ${nombre} al proyecto elegido`}>
        {pending ? "Ubicando…" : "Confirmar"}
      </Button>
      <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setConfirmando(false)}>
        Cancelar
      </Button>
    </span>
  );
}
