"use client";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { DatosTesela } from "@/estado/useTeselas";
import { alternarPantalla } from "@/estado/controlesLocales";
import { useReunion } from "@/estado/useReunion";
import { useHablando } from "@/medios/useHablando";
import { Avatar } from "../comunes/Avatar";
import { IconoFijar, IconoMano, IconoMicroOff, IconoPantallaCompleta, IconoPresentar, IconoSalirPantallaCompleta } from "../comunes/Iconos";
import { elementoEnPantallaCompleta, ponerEnPantallaCompleta, salirDePantallaCompleta, soltarOrientacion } from "./pantallaCompleta";
import { Video } from "../comunes/Video";
import { OndasVoz } from "./OndasVoz";

/**
 * Una tesela: vídeo o avatar, nombre, micrófono, mano alzada, indicador de voz y botones de fijar y
 * pantalla completa. Tocarla (cara o nombre) deja solo a esa persona o presentación en pantalla.
 */
export function Tesela({ datos, tamAvatar = 88 }: { datos: DatosTesela; tamAvatar?: number }) {
  const hablando = useHablando(datos.pantalla ? null : datos.audio, datos.microfono);
  const fijado = useReunion((estado) => estado.fijado);
  const alternarFijado = useReunion((estado) => estado.alternarFijado);
  const enfocado = useReunion((estado) => estado.enfocado);
  const enfocar = useReunion((estado) => estado.enfocar);
  const estaFijada = fijado?.id === datos.id && fijado.pantalla === datos.pantalla;
  const enfocada = estaFijada && enfocado;
  const raiz = useRef<HTMLDivElement>(null);
  const [completa, setCompleta] = useState(false);

  useEffect(() => {
    const alCambiar = () => {
      const ahora = elementoEnPantallaCompleta() === raiz.current;
      setCompleta(ahora);
      if (!ahora) soltarOrientacion();
    };
    document.addEventListener("fullscreenchange", alCambiar);
    document.addEventListener("webkitfullscreenchange", alCambiar);
    return () => {
      document.removeEventListener("fullscreenchange", alCambiar);
      document.removeEventListener("webkitfullscreenchange", alCambiar);
    };
  }, []);

  function alTocar(evento: MouseEvent) {
    if ((evento.target as HTMLElement).closest("button, a") || enfocada || completa) return;
    enfocar({ id: datos.id, pantalla: datos.pantalla });
  }

  function alternarCompleta() {
    if (completa) salirDePantallaCompleta();
    else if (raiz.current) void ponerEnPantallaCompleta(raiz.current, datos.pantalla);
  }
  const visibleSiempre = "opacity-100";
  const visibleAlPasar = "opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100";
  const etiqueta = datos.pantalla ? `Presentación de ${datos.esLocal ? "ti" : datos.nombre}` : datos.esLocal ? `${datos.nombre} (Tú)` : datos.nombre;

  return (
    <div
      ref={raiz}
      onClick={alTocar}
      onDoubleClick={alternarCompleta}
      className={`group relative h-full w-full overflow-hidden bg-sala-tesela transition-shadow ${completa ? "" : "rounded-xl"} ${
        enfocada || completa ? "" : "cursor-pointer"
      } ${hablando ? "shadow-[inset_0_0_0_3px_#8DBFEA]" : ""}`}
      data-tesela={datos.clave}
      title={enfocada || completa ? undefined : `Ver solo a ${etiqueta}`}
    >
      {datos.pantalla && datos.esLocal ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 bg-sala-superficie p-4 text-center">
          <IconoPresentar tam={36} className="text-acento" />
          <p className="text-sm text-sala-texto">Estás presentando a todos</p>
          <button onClick={() => void alternarPantalla()} className="rounded-full bg-acento px-4 py-1.5 text-sm font-medium text-gray-900 hover:bg-acento-suave">
            Dejar de presentar
          </button>
        </div>
      ) : datos.video ? (
        <Video flujo={datos.video} espejo={datos.esLocal} ajuste={datos.pantalla || completa ? "contain" : "cover"} className={datos.pantalla ? "bg-black" : ""} />
      ) : (
        <div className="flex h-full items-center justify-center">
          <Avatar nombre={datos.nombre} tam={tamAvatar} className={hablando ? "ring-4 ring-acento/50" : ""} />
        </div>
      )}

      {datos.mano !== null && !datos.pantalla && (
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs font-medium text-gray-900 shadow" title="Mano levantada">
          <IconoMano tam={16} />
        </span>
      )}
      {!datos.pantalla && (
        <span className="absolute right-2 top-2">
          {!datos.microfono ? (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white" title="Micrófono desactivado">
              <IconoMicroOff tam={16} />
            </span>
          ) : (
            hablando && <OndasVoz activo />
          )}
        </span>
      )}
      <span className="absolute bottom-2 left-3 max-w-[60%] truncate text-sm font-medium text-white [text-shadow:0_1px_2px_rgba(0,0,0,.8)]">{etiqueta}</span>
      <div className="absolute bottom-2 right-2 flex gap-1.5">
        {!(datos.pantalla && datos.esLocal) && (
          <button
            onClick={alternarCompleta}
            className={`flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70 focus:opacity-100 ${
              completa || enfocada || datos.pantalla ? visibleSiempre : visibleAlPasar
            }`}
            title={completa ? "Salir de pantalla completa" : "Pantalla completa"}
            aria-label={completa ? "Salir de pantalla completa" : `Ver a ${etiqueta} en pantalla completa`}
          >
            {completa ? <IconoSalirPantallaCompleta tam={16} /> : <IconoPantallaCompleta tam={16} />}
          </button>
        )}
        {!completa && !enfocada && (
          <button
            onClick={() => alternarFijado({ id: datos.id, pantalla: datos.pantalla })}
            className={`flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70 focus:opacity-100 ${
              estaFijada ? visibleSiempre : visibleAlPasar
            }`}
            title={estaFijada ? "Dejar de fijar" : "Fijar"}
            aria-label={estaFijada ? `Dejar de fijar a ${etiqueta}` : `Fijar a ${etiqueta}`}
          >
            <IconoFijar tam={16} className={estaFijada ? "fill-white" : ""} />
          </button>
        )}
      </div>
    </div>
  );
}
