"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { guardarPresentacion, prepararAudio, registrarAudio, registrarEscucha, type Resultado } from "../actions";

const campo = "mt-1 w-full border bg-background px-3 py-2 text-sm outline-none focus:border-foreground";
const boton = "inline-flex min-h-9 items-center border border-foreground bg-foreground px-4 text-sm text-background disabled:opacity-50";

type PerfilMentor = {
  trayectoria: string;
  intereses: string;
  cv_url: string;
  linkedin_url: string;
  audio_path: string | null;
  autoriza_audio: boolean;
  estado: string;
} | null;

export function FormularioPresentacion({ perfil }: { perfil: PerfilMentor }) {
  const [estado, accion, pendiente] = useActionState<Resultado, FormData>(guardarPresentacion, { ok: true, mensaje: "" });
  return <form action={accion} className="max-w-2xl space-y-5 border-t pt-5">
    <label className="block text-sm">Trayectoria y experiencia que querés compartir
      <textarea className={`${campo} min-h-36`} name="trayectoria" maxLength={3000} defaultValue={perfil?.trayectoria} placeholder="Contanos tu experiencia profesional en tus propias palabras." />
    </label>
    <label className="block text-sm">Intereses y aspectos personales que querés compartir
      <textarea className={`${campo} min-h-24`} name="intereses" maxLength={1500} defaultValue={perfil?.intereses} />
    </label>
    <label className="block text-sm">Enlace a tu CV
      <input className={campo} name="cv_url" type="url" maxLength={500} defaultValue={perfil?.cv_url} placeholder="https://..." />
    </label>
    <label className="block text-sm">Enlace a LinkedIn
      <input className={campo} name="linkedin_url" type="url" maxLength={500} defaultValue={perfil?.linkedin_url} placeholder="https://www.linkedin.com/in/..." />
    </label>
    {perfil?.audio_path && <label className="flex items-start gap-3 text-sm">
      <input className="mt-1" type="checkbox" name="autoriza_audio" defaultChecked={perfil.autoriza_audio} />
      Autorizo expresamente a publicar mi audio de presentación junto con mi perfil.
    </label>}
    <div className="flex items-center gap-4">
      <button className={boton} type="submit" disabled={pendiente}>{pendiente ? "Guardando…" : "Guardar y enviar a revisión"}</button>
      {estado.mensaje && <p role="status" className={`text-sm ${estado.ok ? "text-[#666]" : "text-destructive"}`}>{estado.mensaje}</p>}
    </div>
  </form>;
}

export function SubirAudio() {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [subiendo, setSubiendo] = useState(false);
  const [mensaje, setMensaje] = useState<Resultado | null>(null);

  async function subir(archivo: File) {
    setSubiendo(true);
    setMensaje(null);
    try {
      const firma = await prepararAudio(archivo.name, archivo.size);
      if (!firma.ok) { setMensaje({ ok: false, mensaje: firma.mensaje }); return; }
      const cuerpo = new FormData();
      cuerpo.append("cacheControl", "3600");
      cuerpo.append("", new Blob([archivo], { type: firma.mime }), archivo.name);
      const respuesta = await fetch(firma.url, { method: "PUT", body: cuerpo, headers: { "x-upsert": "false" } });
      if (!respuesta.ok) { setMensaje({ ok: false, mensaje: "No se pudo subir el audio. Probá de nuevo." }); return; }
      const resultado = await registrarAudio(firma.ruta, firma.mime);
      setMensaje(resultado);
      if (resultado.ok) router.refresh();
    } catch {
      setMensaje({ ok: false, mensaje: "No se pudo subir el audio. Probá de nuevo." });
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = "";
    }
  }

  return <div className="space-y-2">
    <input ref={input} type="file" accept=".mp3,.m4a,.wav,.webm" className="hidden"
      onChange={(evento) => { const archivo = evento.target.files?.[0]; if (archivo) void subir(archivo); }} />
    <button type="button" className="border px-4 py-2 text-sm disabled:opacity-50" disabled={subiendo} onClick={() => input.current?.click()}>
      {subiendo ? "Subiendo audio…" : "Elegir audio"}
    </button>
    <p className="text-xs text-[#666]">MP3, M4A, WAV o WebM; hasta 10 MB. Si el formato no es compatible, te avisamos antes de subirlo.</p>
    {mensaje && <p role="status" className={`text-sm ${mensaje.ok ? "text-[#666]" : "text-destructive"}`}>{mensaje.mensaje}</p>}
  </div>;
}

export function ReproducirAudio({ mentorId, url }: { mentorId: string; url: string }) {
  const registrado = useRef(false);
  return <audio controls preload="none" src={url} className="max-w-full" onPlay={() => {
    if (!registrado.current) { registrado.current = true; void registrarEscucha(mentorId); }
  }}>Tu navegador no puede reproducir este audio.</audio>;
}
