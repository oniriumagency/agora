"use client";
import { useReunion } from "@/estado/useReunion";
import { BotonCopiarEnlace } from "./BotonCopiarEnlace";

/** Detalles de la reunión: enlace para invitar y cómo funciona la conexión. */
export function PanelInfo() {
  const sala = useReunion((estado) => estado.sala);
  return (
    <div className="flex-1 overflow-y-auto px-6 pb-6 text-sm text-gray-700">
      <h3 className="font-medium text-gray-900">Información para unirse</h3>
      <p className="mt-1 break-all text-gray-600">{typeof window !== "undefined" ? `${window.location.origin}/${sala}` : sala}</p>
      <div className="mt-3">
        <BotonCopiarEnlace />
      </div>
      <hr className="my-6 border-gray-200" />
      <h3 className="font-medium text-gray-900">Cómo viaja tu vídeo</h3>
      <p className="mt-1 leading-relaxed text-gray-600">
        El audio, el vídeo y la pantalla van directos entre los navegadores, cifrados con DTLS-SRTP. Si una red no permite la conexión directa, se usa un relé TURN
        que tampoco puede ver el contenido. El servidor solo presenta a los participantes y reparte el chat.
      </p>
      <h3 className="mt-6 font-medium text-gray-900">Atajos de teclado</h3>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-gray-600">
        <dt className="font-mono text-xs">Ctrl + D</dt>
        <dd>Micrófono</dd>
        <dt className="font-mono text-xs">Ctrl + E</dt>
        <dd>Cámara</dd>
        <dt className="font-mono text-xs">Ctrl + Alt + H</dt>
        <dd>Levantar o bajar la mano</dd>
        <dt className="font-mono text-xs">Ctrl + Alt + C</dt>
        <dd>Abrir o cerrar el chat</dd>
      </dl>
    </div>
  );
}
