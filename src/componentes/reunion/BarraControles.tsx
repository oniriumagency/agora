"use client";
import { alternarCamara, alternarMano, alternarMicrofono, alternarPantalla } from "@/estado/controlesLocales";
import { salir } from "@/estado/sesion";
import { useReunion } from "@/estado/useReunion";
import { puedeCompartirPantalla } from "@/medios/mediosLocales";
import {
  IconoCamara,
  IconoCamaraOff,
  IconoChat,
  IconoColgar,
  IconoInfo,
  IconoMano,
  IconoMicro,
  IconoMicroOff,
  IconoPersonas,
  IconoPresentar,
} from "../comunes/Iconos";
import { BotonControl, BotonPanel } from "./BotonControl";
import { MenuReacciones } from "./MenuReacciones";
import { Reloj } from "./Reloj";

/** Barra inferior: hora y código a la izquierda, controles en el centro y paneles a la derecha. */
export function BarraControles() {
  const local = useReunion((estado) => estado.local);
  const sala = useReunion((estado) => estado.sala);
  const panel = useReunion((estado) => estado.panel);
  const noLeidos = useReunion((estado) => estado.noLeidos);
  const personas = useReunion((estado) => Object.keys(estado.participantes).length + 1);
  const abrirPanel = useReunion((estado) => estado.abrirPanel);

  return (
    <footer className="flex h-[72px] shrink-0 items-center justify-between gap-2 px-3 sm:h-20 sm:px-6">
      <div className="hidden min-w-0 flex-1 items-center gap-3 truncate text-[15px] text-sala-texto md:flex">
        <Reloj />
        <span className="text-sala-borde">|</span>
        <span className="truncate font-medium">{sala}</span>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-3">
        <BotonControl variante={local.microfono ? "normal" : "alerta"} etiqueta={local.microfono ? "Desactivar micrófono (Ctrl + D)" : "Activar micrófono (Ctrl + D)"} onClick={() => void alternarMicrofono()}>
          {local.microfono ? <IconoMicro /> : <IconoMicroOff />}
        </BotonControl>
        <BotonControl variante={local.camara ? "normal" : "alerta"} etiqueta={local.camara ? "Desactivar cámara (Ctrl + E)" : "Activar cámara (Ctrl + E)"} onClick={() => void alternarCamara()}>
          {local.camara ? <IconoCamara /> : <IconoCamaraOff />}
        </BotonControl>
        <BotonControl variante={local.mano !== null ? "activo" : "normal"} etiqueta={local.mano !== null ? "Bajar la mano (Ctrl + Alt + H)" : "Levantar la mano (Ctrl + Alt + H)"} onClick={alternarMano} presionado={local.mano !== null}>
          <IconoMano />
        </BotonControl>
        <MenuReacciones />
        {puedeCompartirPantalla() && (
          <BotonControl variante={local.pantalla ? "activo" : "normal"} etiqueta={local.pantalla ? "Dejar de presentar" : "Presentar pantalla"} onClick={() => void alternarPantalla()} presionado={local.pantalla}>
            <IconoPresentar />
          </BotonControl>
        )}
        <BotonControl variante="colgar" etiqueta="Salir de la llamada" onClick={salir}>
          <IconoColgar />
        </BotonControl>
      </div>
      <div className="flex flex-1 items-center justify-end gap-0.5 sm:gap-1">
        <span className="hidden sm:block">
          <BotonPanel etiqueta="Detalles de la reunión" activo={panel === "info"} onClick={() => abrirPanel("info")}>
            <IconoInfo />
          </BotonPanel>
        </span>
        <BotonPanel etiqueta="Personas" activo={panel === "personas"} onClick={() => abrirPanel("personas")} contador={personas} neutro>
          <IconoPersonas />
        </BotonPanel>
        <BotonPanel etiqueta="Chat con todos" activo={panel === "chat"} onClick={() => abrirPanel("chat")} contador={noLeidos}>
          <IconoChat />
        </BotonPanel>
      </div>
    </footer>
  );
}
