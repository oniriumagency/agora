"use client";
import { useReunion } from "@/estado/useReunion";

/** Emojis que suben por la izquierda de la pantalla con el nombre de quien reaccionó. */
export function ReaccionesFlotantes() {
  const reacciones = useReunion((estado) => estado.reacciones);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-20 h-0" aria-hidden="true">
      {reacciones.map((reaccion) => (
        <div key={reaccion.id} className="absolute bottom-0 flex flex-col items-center animate-subir" style={{ left: `${reaccion.izquierda}%` }}>
          <span className="text-5xl">{reaccion.emoji}</span>
          <span className="mt-1 max-w-[120px] truncate rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">{reaccion.nombre}</span>
        </div>
      ))}
    </div>
  );
}
