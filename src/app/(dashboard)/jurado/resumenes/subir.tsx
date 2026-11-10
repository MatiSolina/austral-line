"use client";
// GRUPO JURADO — subir la presentación o la transcripción de un equipo (reemplaza la que hubiera).
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { extensiones, tipos, type Tipo } from "../_resumenes";
import { prepararSubida, registrarArchivo } from "./acciones";

type Props = { eventoId: string; proyectoId: string; tipo: Tipo; reemplaza?: boolean };

export function Subir({ eventoId, proyectoId, tipo, reemplaza }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [subiendo, setSubiendo] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);

  async function subir(archivo: File) {
    setSubiendo(true);
    setMensaje(null);
    const firma = await prepararSubida(eventoId, proyectoId, tipo, archivo.name, archivo.size);
    if (!firma.ok) {
      setMensaje({ ok: false, texto: firma.mensaje });
    } else {
      // Mismo formato que usa supabase-js para subir a una URL firmada.
      const cuerpo = new FormData();
      cuerpo.append("cacheControl", "3600");
      cuerpo.append("", new Blob([archivo], { type: firma.mime }), archivo.name);
      const respuesta = await fetch(firma.url, { method: "PUT", body: cuerpo, headers: { "x-upsert": "false" } }).catch(() => null);
      if (!respuesta?.ok) {
        setMensaje({ ok: false, texto: "No se pudo subir. Probá de nuevo." });
      } else {
        const registro = await registrarArchivo(eventoId, proyectoId, tipo, firma.ruta, archivo.name, archivo.size);
        setMensaje({ ok: registro.ok, texto: registro.mensaje });
      }
    }
    setSubiendo(false);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept={extensiones(tipo)}
        className="hidden"
        onChange={(e) => e.target.files?.[0] && subir(e.target.files[0])}
      />
      <Button type="button" variant={reemplaza ? "ghost" : "outline"} size="sm" disabled={subiendo} onClick={() => input.current?.click()}>
        {subiendo ? "Subiendo…" : reemplaza ? "Reemplazar" : tipos[tipo].boton}
      </Button>
      {mensaje && <p className={`mt-1 text-xs ${mensaje.ok ? "text-[#666]" : "text-destructive"}`}>{mensaje.texto}</p>}
    </div>
  );
}
