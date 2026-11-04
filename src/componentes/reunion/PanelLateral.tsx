"use client";
import { useReunion } from "@/estado/useReunion";
import { IconoCerrar } from "../comunes/Iconos";
import { PanelChat } from "./PanelChat";
import { PanelInfo } from "./PanelInfo";
import { PanelPersonas } from "./PanelPersonas";

/** Panel blanco a la derecha (a pantalla completa en móvil) con chat, personas o detalles. */
const TITULOS = { chat: "Mensajes de la llamada", personas: "Personas", info: "Detalles de la reunión" } as const;

export function PanelLateral() {
  const panel = useReunion((estado) => estado.panel);
  const abrirPanel = useReunion((estado) => estado.abrirPanel);
  if (!panel) return null;

  return (
    <aside
      className="fixed inset-0 z-30 flex flex-col bg-white text-gray-900 animate-aparecer md:static md:z-auto md:h-full md:w-[360px] md:shrink-0 md:rounded-2xl"
      aria-label={TITULOS[panel]}
    >
      <div className="flex items-center justify-between py-3 pl-6 pr-3">
        <h2 className="text-lg">{TITULOS[panel]}</h2>
        <button onClick={() => abrirPanel(null)} className="flex h-10 w-10 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100" aria-label="Cerrar panel">
          <IconoCerrar />
        </button>
      </div>
      {panel === "chat" && <PanelChat />}
      {panel === "personas" && <PanelPersonas />}
      {panel === "info" && <PanelInfo />}
    </aside>
  );
}
