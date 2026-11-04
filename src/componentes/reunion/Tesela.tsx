"use client";
import type { DatosTesela } from "@/estado/useTeselas";
import { alternarPantalla } from "@/estado/controlesLocales";
import { useReunion } from "@/estado/useReunion";
import { useHablando } from "@/medios/useHablando";
import { Avatar } from "../comunes/Avatar";
import { IconoFijar, IconoMano, IconoMicroOff, IconoPresentar } from "../comunes/Iconos";
import { Video } from "../comunes/Video";
import { OndasVoz } from "./OndasVoz";

/** Una tesela: vídeo o avatar, nombre, micrófono, mano alzada, indicador de voz y botón de fijar. */
export function Tesela({ datos, tamAvatar = 88 }: { datos: DatosTesela; tamAvatar?: number }) {
  const hablando = useHablando(datos.pantalla ? null : datos.audio, datos.microfono);
  const fijado = useReunion((estado) => estado.fijado);
  const alternarFijado = useReunion((estado) => estado.alternarFijado);
  const estaFijada = fijado?.id === datos.id && fijado.pantalla === datos.pantalla;
  const etiqueta = datos.pantalla ? `Presentación de ${datos.esLocal ? "ti" : datos.nombre}` : datos.esLocal ? `${datos.nombre} (Tú)` : datos.nombre;
  const conectando = !datos.esLocal && datos.conexion !== "connected";

  return (
    <div
      className={`group relative h-full w-full overflow-hidden rounded-xl bg-sala-tesela transition-shadow ${
        hablando ? "shadow-[inset_0_0_0_3px_#8ab4f8]" : ""
      }`}
      data-tesela={datos.clave}
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
        <Video flujo={datos.video} espejo={datos.esLocal} ajuste={datos.pantalla ? "contain" : "cover"} className={datos.pantalla ? "bg-black" : ""} />
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
      {conectando && (
        <span className="absolute inset-x-0 top-1/2 mt-12 text-center text-xs text-sala-tenue">
          {datos.conexion === "failed" || datos.conexion === "disconnected" ? "Problemas de conexión…" : "Conectando…"}
        </span>
      )}
      <span className="absolute bottom-2 left-3 max-w-[75%] truncate text-sm font-medium text-white [text-shadow:0_1px_2px_rgba(0,0,0,.8)]">{etiqueta}</span>
      <button
        onClick={() => alternarFijado({ id: datos.id, pantalla: datos.pantalla })}
        className={`absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70 focus:opacity-100 ${
          estaFijada ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
        title={estaFijada ? "Dejar de fijar" : "Fijar"}
        aria-label={estaFijada ? `Dejar de fijar a ${etiqueta}` : `Fijar a ${etiqueta}`}
      >
        <IconoFijar tam={16} className={estaFijada ? "fill-white" : ""} />
      </button>
    </div>
  );
}
