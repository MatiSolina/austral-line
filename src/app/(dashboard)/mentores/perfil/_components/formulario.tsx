"use client";
// GRUPO MENTORES — UI de carga de perfil. El mentor escribe libre, la IA propone una
// organización en campos, y el mentor confirma campo por campo antes de guardar: si ya había
// un valor cargado, el default es "mantener" (nunca se pisa sin que él elija lo contrario).
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { camposPerfil, type PerfilMentor } from "../../_lib";
import { guardarCambios, organizar, publicar } from "../_acciones";
import type { PropuestaPerfil, ResultadoOrganizar } from "../_ia";

type Campo = (typeof camposPerfil)[number]["campo"];

function asignar<K extends Campo>(destino: Partial<PropuestaPerfil>, campo: K, valor: PropuestaPerfil[K]) {
  destino[campo] = valor;
}

export function FormularioPerfil({ perfil }: { perfil: PerfilMentor | null }) {
  const [texto, setTexto] = useState(perfil?.texto_original ?? "");
  const [propuesta, setPropuesta] = useState<ResultadoOrganizar | null>(null);
  const [elecciones, setElecciones] = useState<Partial<Record<Campo, "actual" | "nuevo">>>({});
  const [errores, setErrores] = useState<string[]>([]);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, iniciarTransicion] = useTransition();

  const publicado = perfil?.estado === "publicado";

  function onOrganizar() {
    setErrores([]);
    setMensaje(null);
    iniciarTransicion(async () => {
      try {
        const resultado = await organizar(texto);
        setPropuesta(resultado);
        // Default: si ya había un valor y la IA propone algo distinto, se mantiene el actual
        // hasta que el mentor elija reemplazarlo. Si no había nada, no hay nada que pisar.
        const nuevasElecciones: Partial<Record<Campo, "actual" | "nuevo">> = {};
        for (const { campo } of camposPerfil) {
          const actual = perfil?.[campo] ?? null;
          nuevasElecciones[campo] = actual ? "actual" : "nuevo";
        }
        setElecciones(nuevasElecciones);
      } catch {
        setErrores(["No se pudo organizar el texto. Probá de nuevo en un momento."]);
      }
    });
  }

  function onGuardar(publicarDespues: boolean) {
    setErrores([]);
    setMensaje(null);
    iniciarTransicion(async () => {
      try {
        if (propuesta) {
          const aceptados: Partial<PropuestaPerfil> = {};
          for (const { campo } of camposPerfil) {
            if (elecciones[campo] === "nuevo") asignar(aceptados, campo, propuesta.propuesta[campo]);
          }
          if (Object.keys(aceptados).length > 0) await guardarCambios(aceptados);
        }
        setPropuesta(null);
        if (publicarDespues) {
          const resultado = await publicar();
          if (resultado.errores.length > 0) setErrores(resultado.errores);
          else setMensaje("¡Perfil publicado! Ya lo pueden ver los alumnos.");
        } else {
          setMensaje("Borrador guardado. Podés volver cuando quieras a terminarlo.");
        }
      } catch {
        setErrores(["No se pudo guardar. Probá de nuevo en un momento."]);
      }
    });
  }

  return (
    <div className="grid gap-8">
      {publicado && (
        <p className="border-l-2 border-primary pl-4 text-sm text-[#666]">
          Tu perfil ya está publicado. Si corregís algo acá, el cambio queda guardado al instante.
        </p>
      )}

      <div className="grid gap-2">
        <Label htmlFor="texto">Contanos sobre vos, en tus palabras</Label>
        <p className="text-sm text-[#666]">
          Empresa, cargo, industria, años de experiencia, en qué podés ayudar a los alumnos y tu LinkedIn si tenés.
          El agente lo organiza por vos; no hace falta llenar un formulario.
        </p>
        <textarea
          id="texto"
          rows={6}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className="w-full border bg-transparent p-3 text-sm outline-none focus-visible:border-ring"
        />
        <div>
          <Button type="button" variant="outline" onClick={onOrganizar} disabled={pendiente || !texto.trim()}>
            Organizar con IA
          </Button>
        </div>
      </div>

      {propuesta?.advertenciaSpam && (
        <p className="border-l-2 border-destructive pl-4 text-sm text-destructive">
          Esto quedó marcado para que lo revise el administrador antes de poder publicarse
          {propuesta.motivoSpam ? `: ${propuesta.motivoSpam}` : "."}
        </p>
      )}

      {propuesta && propuesta.correcciones.length > 0 && (
        <p className="border-l-2 border-primary pl-4 text-sm text-[#666]">
          El agente ajustó algo solo antes de mostrarte esta propuesta (por ejemplo, {propuesta.correcciones[0].campo}:{" "}
          {propuesta.correcciones[0].razon}), para no inventar ni guardar datos raros.
        </p>
      )}

      {propuesta && (
        <div className="grid gap-6 border bg-card p-5">
          <p className="text-sm text-[#666]">Así quedaría tu perfil. Donde ya tenías un dato cargado, elegí si lo mantenés o lo reemplazás.</p>
          {camposPerfil.map(({ campo, label }) => {
            const actual = perfil?.[campo] ?? null;
            const nuevo = propuesta.propuesta[campo] ?? null;
            if (!actual && !nuevo) return null;
            return (
              <div key={campo} className="grid gap-2 border-b pb-4 last:border-b-0 last:pb-0">
                <Label>{label}</Label>
                {actual && nuevo && String(actual) !== String(nuevo) ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex cursor-pointer items-start gap-2 border p-2 text-sm">
                      <input type="radio" name={`eleccion-${campo}`} checked={elecciones[campo] !== "nuevo"}
                        onChange={() => setElecciones((e) => ({ ...e, [campo]: "actual" }))} />
                      <span><span className="text-[#666]">Mantener: </span>{actual}</span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 border p-2 text-sm">
                      <input type="radio" name={`eleccion-${campo}`} checked={elecciones[campo] === "nuevo"}
                        onChange={() => setElecciones((e) => ({ ...e, [campo]: "nuevo" }))} />
                      <span><span className="text-[#666]">Reemplazar por: </span>{nuevo}</span>
                    </label>
                  </div>
                ) : (
                  <p className="text-sm">{nuevo ?? actual}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!propuesta && perfil && (
        <div className="grid gap-4 border bg-card p-5">
          <p className="text-sm text-[#666]">Tu perfil hoy:</p>
          {camposPerfil.map(({ campo, label }) =>
            perfil[campo] ? <p key={campo} className="text-sm"><span className="text-[#666]">{label}: </span>{perfil[campo]}</p> : null,
          )}
        </div>
      )}

      {errores.length > 0 && (
        <ul className="list-inside list-disc text-sm text-destructive">
          {errores.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}
      {mensaje && <p className="text-sm text-primary">{mensaje}</p>}

      <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-background py-4">
        <Button type="button" variant="outline" onClick={() => onGuardar(false)} disabled={pendiente}>Guardar borrador</Button>
        <Button type="button" size="lg" onClick={() => onGuardar(true)} disabled={pendiente}>
          {publicado ? "Guardar y actualizar" : "Publicar perfil"}
        </Button>
      </div>
    </div>
  );
}
