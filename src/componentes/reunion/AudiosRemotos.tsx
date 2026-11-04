"use client";
import { useEffect, useRef } from "react";
import { useReunion } from "@/estado/useReunion";

/** Reproduce el audio de cada participante, independiente de si su tesela está a la vista. */
function AudioRemoto({ flujo }: { flujo: MediaStream }) {
  const referencia = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const audio = referencia.current;
    if (!audio) return;
    audio.srcObject = flujo;
    void audio.play().catch(() => undefined);
  }, [flujo]);
  return <audio ref={referencia} autoPlay />;
}

export function AudiosRemotos() {
  const participantes = useReunion((estado) => estado.participantes);
  return (
    <div className="hidden">
      {Object.values(participantes).map((participante) => participante.flujos.audio && <AudioRemoto key={participante.id} flujo={participante.flujos.audio} />)}
    </div>
  );
}
