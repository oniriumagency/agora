"use client";
import { useEffect, useState } from "react";
import { useReunion } from "@/estado/useReunion";
import { quererPantallaEncendida } from "@/medios/pantallaEncendida";

/**
 * Pantalla del celular en llamadas solo de audio (nadie con cámara ni compartiendo pantalla):
 * - Android: no se fuerza nada. El teléfono se apaga y bloquea con el tiempo que tenga configurado
 *   y el audio sigue en los dos sentidos (Chrome mantiene viva la llamada).
 * - iPhone: al bloquearse, iOS corta el audio de las páginas web. Por eso la pantalla se mantiene
 *   encendida y, pasado el tiempo elegido sin tocarla, se cubre de negro puro (en OLED es
 *   prácticamente apagada). Ninguna web puede leer el tiempo de bloqueo del sistema, así que se
 *   elige en el panel de información (30 s por defecto). Un toque la despierta.
 * Con vídeo en pantalla, la pantalla siempre queda encendida.
 */
const CLAVE_ESPERA = "agora.bolsillo";
export const ESPERAS_BOLSILLO = [10, 30, 60, 120, 300];

export function esperaBolsillo(): number {
  try {
    const guardada = Number(localStorage.getItem(CLAVE_ESPERA));
    return ESPERAS_BOLSILLO.includes(guardada) ? guardada : 30;
  } catch {
    return 30;
  }
}

export function fijarEsperaBolsillo(segundos: number): void {
  try {
    localStorage.setItem(CLAVE_ESPERA, String(segundos));
  } catch {
    /* solo esta sesión */
  }
  window.dispatchEvent(new Event("agora-bolsillo"));
}

export function esIPhone(): boolean {
  if (typeof navigator === "undefined") return false;
  // iPadOS se presenta como Mac: se distingue por la pantalla táctil
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

export function ModoBolsillo() {
  const hayVideo = useReunion(
    (estado) =>
      estado.local.camara ||
      estado.local.pantalla ||
      Object.values(estado.participantes).some((p) => !p.estado.ausente && (p.estado.camara || p.estado.pantalla)),
  );
  const [plataforma, setPlataforma] = useState<"escritorio" | "android" | "iphone">("escritorio");
  const [espera, setEspera] = useState(30);
  const [oscura, setOscura] = useState(false);

  useEffect(() => {
    const tactil = window.matchMedia("(pointer: coarse)").matches;
    setPlataforma(esIPhone() ? "iphone" : tactil ? "android" : "escritorio");
    setEspera(esperaBolsillo());
    const alCambiar = () => setEspera(esperaBolsillo());
    window.addEventListener("agora-bolsillo", alCambiar);
    return () => window.removeEventListener("agora-bolsillo", alCambiar);
  }, []);

  // Android en audio: que el sistema apague y bloquee como siempre
  useEffect(() => {
    quererPantallaEncendida(!(plataforma === "android" && !hayVideo));
    return () => quererPantallaEncendida(true);
  }, [plataforma, hayVideo]);

  useEffect(() => {
    if (plataforma !== "iphone" || hayVideo) {
      setOscura(false);
      return;
    }
    if (oscura) return; // ya en negro: espera un toque
    let temporizador = setTimeout(() => setOscura(true), espera * 1000);
    const actividad = () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => setOscura(true), espera * 1000);
    };
    const eventos = ["pointerdown", "touchstart", "keydown"] as const;
    eventos.forEach((evento) => window.addEventListener(evento, actividad, { passive: true }));
    return () => {
      clearTimeout(temporizador);
      eventos.forEach((evento) => window.removeEventListener(evento, actividad));
    };
  }, [plataforma, hayVideo, oscura, espera]);

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
