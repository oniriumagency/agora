import { useEffect, useState } from "react";

/**
 * Indica si alguien está hablando según el nivel de su audio (un analizador por flujo sobre un
 * único AudioContext compartido). Se usa para el anillo de la tesela y el icono de ondas.
 */
let contexto: AudioContext | null = null;
const UMBRAL = 0.035;
const RETENCION_MS = 450;

function obtenerContexto(): AudioContext | null {
  if (typeof AudioContext === "undefined") return null;
  contexto ??= new AudioContext();
  if (contexto.state === "suspended") void contexto.resume();
  return contexto;
}

export function useHablando(flujo: MediaStream | null | undefined, activo: boolean): boolean {
  const [hablando, setHablando] = useState(false);

  useEffect(() => {
    const ctx = activo && flujo && flujo.getAudioTracks().length > 0 ? obtenerContexto() : null;
    if (!ctx || !flujo) {
      setHablando(false);
      return;
    }
    const fuente = ctx.createMediaStreamSource(flujo);
    const analizador = ctx.createAnalyser();
    analizador.fftSize = 512;
    fuente.connect(analizador);
    const muestras = new Float32Array(analizador.fftSize);
    let ultimoSonido = 0;
    const temporizador = setInterval(() => {
      analizador.getFloatTimeDomainData(muestras);
      let suma = 0;
      for (const muestra of muestras) suma += muestra * muestra;
      const ahora = performance.now();
      if (Math.sqrt(suma / muestras.length) > UMBRAL) ultimoSonido = ahora;
      setHablando(ahora - ultimoSonido < RETENCION_MS);
    }, 100);
    return () => {
      clearInterval(temporizador);
      fuente.disconnect();
    };
  }, [flujo, activo]);

  return hablando;
}
