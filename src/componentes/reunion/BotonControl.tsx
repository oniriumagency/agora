import type { ReactNode } from "react";

/** Botón redondo de la barra inferior. "alerta" (rojo) para lo apagado, "activo" (azul) para lo encendido. */
type Variante = "normal" | "alerta" | "activo" | "colgar";

const ESTILOS: Record<Variante, string> = {
  normal: "bg-sala-tesela text-white hover:bg-sala-borde",
  alerta: "bg-peligro text-white hover:bg-peligro-fuerte",
  activo: "bg-acento-suave text-gray-900 hover:bg-acento",
  colgar: "w-14 sm:w-16 bg-peligro text-white hover:bg-peligro-fuerte",
};

export function BotonControl({
  variante = "normal",
  etiqueta,
  onClick,
  children,
  presionado,
}: {
  variante?: Variante;
  etiqueta: string;
  onClick: () => void;
  children: ReactNode;
  presionado?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={etiqueta}
      aria-label={etiqueta}
      aria-pressed={presionado}
      className={`flex h-10 min-w-10 shrink-0 items-center justify-center rounded-full px-2.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento sm:h-12 sm:min-w-12 sm:px-3 ${ESTILOS[variante]}`}
    >
      {children}
    </button>
  );
}

/** Botón de icono de la derecha de la barra (información, personas, chat), con contador opcional. */
export function BotonPanel({ etiqueta, activo, onClick, contador, neutro = false, children }: { etiqueta: string; activo: boolean; onClick: () => void; contador?: number; neutro?: boolean; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={etiqueta}
      aria-label={etiqueta}
      aria-pressed={activo}
      className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-colors sm:h-12 sm:w-12 ${activo ? "bg-acento-suave/20 text-acento" : "text-white hover:bg-white/10"}`}
    >
      {children}
      {!!contador && (
        <span className={`absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold ${neutro ? "bg-sala-tesela text-white" : "bg-acento text-gray-900"}`}>
          {contador > 99 ? "99+" : contador}
        </span>
      )}
    </button>
  );
}
