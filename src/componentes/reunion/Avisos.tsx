"use client";
import { useReunion } from "@/estado/useReunion";

/** Avisos breves abajo a la izquierda: entradas, salidas, manos, mensajes y errores de medios. */
export function Avisos() {
  const avisos = useReunion((estado) => estado.avisos);
  return (
    <div className="pointer-events-none fixed bottom-24 left-4 z-40 flex max-w-[min(360px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
      {avisos.map((aviso) => (
        <div key={aviso.id} className="flex items-start gap-3 rounded-lg bg-[#3c4043] px-4 py-3 text-sm text-white shadow-lg animate-aparecer">
          {aviso.icono && <span aria-hidden="true">{aviso.icono}</span>}
          <span className="line-clamp-3 break-words">{aviso.texto}</span>
        </div>
      ))}
    </div>
  );
}
