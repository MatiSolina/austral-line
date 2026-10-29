"use client";
// GRUPO AUSTRAL — elegir y subir uno o varios documentos al proyecto.
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { extensionesAceptadas } from "../_preparacion";
import { prepararSubida, registrarDocumento } from "./acciones";

export function Subir({ proyectoId }: { proyectoId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [subiendo, setSubiendo] = useState(false);
  const [mensajes, setMensajes] = useState<{ ok: boolean; texto: string }[]>([]);

  async function subir(archivos: FileList) {
    setSubiendo(true);
    const resultados: { ok: boolean; texto: string }[] = [];
    for (const archivo of Array.from(archivos)) {
      const firma = await prepararSubida(proyectoId, archivo.name, archivo.size);
      if (!firma.ok) {
        resultados.push({ ok: false, texto: `${archivo.name}: ${firma.mensaje}` });
        continue;
      }
      // Mismo formato que usa supabase-js para subir a una URL firmada.
      const cuerpo = new FormData();
      cuerpo.append("cacheControl", "3600");
      cuerpo.append("", new Blob([archivo], { type: firma.tipo }), archivo.name);
      const respuesta = await fetch(firma.url, { method: "PUT", body: cuerpo, headers: { "x-upsert": "false" } }).catch(() => null);
      if (!respuesta?.ok) {
        resultados.push({ ok: false, texto: `${archivo.name}: no se pudo subir. Probá de nuevo.` });
        continue;
      }
      const registro = await registrarDocumento(proyectoId, firma.ruta, archivo.name, archivo.size);
      resultados.push({ ok: registro.ok, texto: registro.ok ? registro.mensaje : `${archivo.name}: ${registro.mensaje}` });
    }
    setMensajes(resultados);
    setSubiendo(false);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        multiple
        accept={extensionesAceptadas}
        className="hidden"
        onChange={(e) => e.target.files?.length && subir(e.target.files)}
      />
      <Button type="button" variant="outline" size="sm" disabled={subiendo} onClick={() => input.current?.click()}>
        {subiendo ? "Subiendo…" : "Subir documentos"}
      </Button>
      {mensajes.map((m, i) => (
        <p key={i} className={`mt-2 text-sm ${m.ok ? "text-[#666]" : "text-destructive"}`}>{m.texto}</p>
      ))}
    </div>
  );
}
