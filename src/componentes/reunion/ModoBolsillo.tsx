"use client";
import { useEffect, useState } from "react";
import { useReunion } from "@/estado/useReunion";

/**
 * Modo bolsillo (solo celular). Una página web no puede apagar la pantalla sin que el teléfono se
 * bloquee, y al bloquearse iPhone corta el audio. Así que la pantalla se mantiene encendida (Wake
 * Lock) y, si la llamada es solo de audio, tras unos segundos sin tocarla se cubre de negro puro:
 * en pantallas OLED eso es prácticamente apagada, y el audio sigue en los dos sentidos.
 * Un toque la despierta. Si alguien comparte pantalla o tiene la cámara encendida, no se oscurece.
 */
const ESPERA_MS = 20_000;

export function ModoBolsillo() {
  const hayVideo = useReunion(
    (estado) =>
      estado.local.camara ||
      estado.local.pantalla ||
      Object.values(estado.participantes).some((p) => !p.estado.ausente && (p.estado.camara || p.estado.pantalla)),
  );
  const [esCelular, setEsCelular] = useState(false);
  const [oscura, setOscura] = useState(false);

  useEffect(() => setEsCelular(window.matchMedia("(pointer: coarse)").matches), []);

  useEffect(() => {
    if (!esCelular || hayVideo) {
      setOscura(false); // con vídeo en pantalla, nunca se oscurece
      return;
    }
    if (oscura) return; // ya en negro: espera un toque
    let temporizador = setTimeout(() => setOscura(true), ESPERA_MS);
    const actividad = () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => setOscura(true), ESPERA_MS);
    };
    const eventos = ["pointerdown", "touchstart", "keydown"] as const;
    eventos.forEach((evento) => window.addEventListener(evento, actividad, { passive: true }));
    return () => {
      clearTimeout(temporizador);
      eventos.forEach((evento) => window.removeEventListener(evento, actividad));
    };
  }, [esCelular, hayVideo, oscura]);

  if (!oscura) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex cursor-pointer items-end justify-center bg-black pb-16"
      // Se despierta al soltar el dedo (click), no al apoyarlo: así el toque no atraviesa a los botones de debajo
      onClick={() => setOscura(false)}
      role="button"
      aria-label="Llamada en curso. Toca para encender la pantalla."
    >
      <span className="animate-pulse text-xs text-white/15">Llamada en curso · toca para volver</span>
    </div>
  );
}
