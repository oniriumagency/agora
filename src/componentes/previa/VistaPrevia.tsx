"use client";
import { alternarCamara, alternarMicrofono } from "@/estado/controlesLocales";
import { useReunion } from "@/estado/useReunion";
import { useHablando } from "@/medios/useHablando";
import { Avatar } from "../comunes/Avatar";
import { IconoCamara, IconoCamaraOff, IconoMicro, IconoMicroOff } from "../comunes/Iconos";
import { Video } from "../comunes/Video";

/** Vista previa en la sala de espera, con los botones de micrófono y cámara superpuestos. */
export function VistaPrevia({ nombre, cargando }: { nombre: string; cargando: boolean }) {
  const local = useReunion((estado) => estado.local);
  const hablando = useHablando(local.flujoMicro, local.microfono);
  const boton = (activo: boolean) =>
    `flex h-14 w-14 items-center justify-center rounded-full border transition ${
      activo ? "border-white/70 text-white hover:bg-white/15" : "border-transparent bg-peligro text-white hover:bg-peligro-fuerte"
    }`;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-sala-fondo shadow-md">
      {local.camara && local.flujoCamara ? (
        <Video flujo={local.flujoCamara} espejo />
      ) : (
        <div className="flex h-full items-center justify-center text-lg text-white">
          {cargando ? "Iniciando cámara…" : local.camara ? "" : <Avatar nombre={nombre} tam={112} />}
        </div>
      )}
      <span className="absolute left-4 top-3 text-white drop-shadow">{nombre}</span>
      {!local.camara && !cargando && <span className="absolute inset-x-0 top-[18%] text-center text-white/80">La cámara está desactivada</span>}
      <div className="absolute inset-x-0 bottom-4 flex justify-center gap-4">
        <button type="button" onClick={() => void alternarMicrofono()} className={`${boton(local.microfono)} ${hablando ? "ring-4 ring-acento/60" : ""}`} aria-label={local.microfono ? "Desactivar micrófono" : "Activar micrófono"}>
          {local.microfono ? <IconoMicro /> : <IconoMicroOff />}
        </button>
        <button type="button" onClick={() => void alternarCamara()} className={boton(local.camara)} aria-label={local.camara ? "Desactivar cámara" : "Activar cámara"}>
          {local.camara ? <IconoCamara /> : <IconoCamaraOff />}
        </button>
      </div>
    </div>
  );
}
