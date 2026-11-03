"use client";
// GRUPO JURADO — lee un texto en voz alta con la voz del navegador (gratis, sin servicios externos).
// Es opcional: el mismo texto siempre está escrito al lado para quien prefiera leerlo.
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

function vozEnEspanol() {
  const voces = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("es"));
  return voces.find((v) => v.lang === "es-AR") ?? voces.find((v) => v.lang === "es-419" || v.lang === "es-US") ?? voces[0];
}

export function Escuchar({ texto }: { texto: string }) {
  const [estado, setEstado] = useState<"quieto" | "hablando" | "pausa">("quieto");
  // En el servidor asumimos que sí, para no mostrar el aviso de más mientras carga.
  const soportado = useSyncExternalStore(() => () => {}, () => "speechSynthesis" in window, () => true);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  function reproducir() {
    const s = window.speechSynthesis;
    if (estado === "pausa") {
      s.resume();
      setEstado("hablando");
      return;
    }
    s.cancel();
    const frase = new SpeechSynthesisUtterance(texto);
    const voz = vozEnEspanol();
    if (voz) frase.voice = voz;
    frase.lang = voz?.lang ?? "es-AR";
    frase.rate = 0.95;
    frase.onend = () => setEstado("quieto");
    frase.onerror = () => setEstado("quieto");
    s.speak(frase);
    setEstado("hablando");
  }

  if (!soportado) return <p className="text-sm text-[#666]">Este navegador no puede leer en voz alta: el resumen está escrito abajo.</p>;
  return (
    <div className="flex items-center gap-2">
      {estado === "hablando" ? (
        <Button type="button" variant="outline" size="sm" onClick={() => { window.speechSynthesis.pause(); setEstado("pausa"); }}>Pausar</Button>
      ) : (
        <Button type="button" size="sm" onClick={reproducir}>{estado === "pausa" ? "Seguir" : "▶ Escuchar"}</Button>
      )}
      {estado !== "quieto" && (
        <Button type="button" variant="ghost" size="sm" onClick={() => { window.speechSynthesis.cancel(); setEstado("quieto"); }}>Detener</Button>
      )}
    </div>
  );
}
