"use client";

// GRUPO ALUMNOS — botón "Guardar perfil" que revisa el mínimo de temas ANTES de enviar.
// Si faltan temas, avisa sin recargar la página, así el alumno no pierde lo que ya eligió.
// La base vuelve a controlar el mínimo al guardar (alumnos_guardar_perfil).
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function BotonGuardar({ minimo }: { minimo: number }) {
  const [aviso, setAviso] = useState<string | null>(null);

  return (
    <>
      <Button
        type="submit"
        onClick={(e) => {
          const form = e.currentTarget.closest("form");
          const calificados = form
            ? [...form.querySelectorAll<HTMLInputElement>('input[type="radio"][name^="interes_"]:checked')].filter(
                (r) => Number(r.value) >= 1,
              ).length
            : minimo;
          if (calificados < minimo) {
            e.preventDefault();
            setAviso(`Calificá al menos ${minimo} temas (calificaste ${calificados}). No se perdió nada de lo que elegiste.`);
          } else {
            setAviso(null);
          }
        }}
      >
        Guardar perfil
      </Button>
      {aviso && <p role="alert" className="text-sm text-destructive">{aviso}</p>}
    </>
  );
}
