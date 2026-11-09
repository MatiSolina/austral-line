"use client";
// GRUPO JURADO — lee un texto en voz alta con la voz del navegador (gratis, sin servicios externos).
// Es opcional: el mismo texto siempre está escrito al lado para quien prefiera leerlo.
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

// Algunas voces "en línea" de Chrome cortan la lectura de un texto largo a los pocos segundos. Por eso se lee de a
// oraciones (y las oraciones muy largas, de a partes separadas por comas): cada trozo es corto y van en cola.
const MAX_TROZO = 200;
function trozos(texto: string) {
  const oraciones = texto.replace(/\s+/g, " ").match(/[^.!?…]+(?:[.!?…]+["”»)]*|$)/g) ?? [];
  return oraciones.flatMap((oracion) => {
    if (oracion.length <= MAX_TROZO) return [oracion];
    const partes: string[] = [];
    for (const pedazo of oracion.split(/(?<=[,;:])\s/)) {
      const ultima = partes.at(-1);
      if (ultima && ultima.length + pedazo.length < MAX_TROZO) partes[partes.length - 1] = `${ultima} ${pedazo}`;
      else partes.push(pedazo);
    }
    return partes;
  }).map((t) => t.trim()).filter(Boolean);
}

function vozEnEspanol() {
  const voces = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("es"));
  return voces.find((v) => v.lang === "es-AR") ?? voces.find((v) => v.lang === "es-419" || v.lang === "es-US") ?? voces[0];
}

export function Escuchar({ texto }: { texto: string }) {
  const id = useId();
  const [estado, setEstado] = useState<"quieto" | "hablando" | "pausa">("quieto");
  // En el servidor asumimos que sí, para no mostrar el aviso de más mientras carga.
  const soportado = useSyncExternalStore(() => () => {}, () => "speechSynthesis" in window, () => true);

  // El navegador tiene una sola voz: si arranca otro botón de la página, este vuelve a "Escuchar".
  useEffect(() => {
    const otroEmpezo = (e: Event) => { if ((e as CustomEvent).detail !== id) setEstado("quieto"); };
    window.addEventListener("jurado-escuchar", otroEmpezo);
    return () => {
      window.removeEventListener("jurado-escuchar", otroEmpezo);
      window.speechSynthesis?.cancel();
    };
  }, [id]);

  function reproducir() {
    const s = window.speechSynthesis;
    if (estado === "pausa") {
      s.resume();
      setEstado("hablando");
      return;
    }
    s.cancel();
    window.dispatchEvent(new CustomEvent("jurado-escuchar", { detail: id }));
    const voz = vozEnEspanol();
    const partes = trozos(texto);
    partes.forEach((parte, i) => {
      const frase = new SpeechSynthesisUtterance(parte);
      if (voz) frase.voice = voz;
      frase.lang = voz?.lang ?? "es-AR";
      frase.rate = 0.95;
      if (i === partes.length - 1) frase.onend = () => setEstado("quieto");
      frase.onerror = () => setEstado("quieto"); // también salta al detener o si arranca otro botón
      s.speak(frase);
    });
    setEstado(partes.length ? "hablando" : "quieto");
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
