"use client";
import { useState } from "react";
import { useReunion } from "@/estado/useReunion";
import { fijarSonidos, prepararSonidos, sonarEntrada, sonidosActivados } from "@/medios/sonidos";
import { BotonCopiarEnlace } from "./BotonCopiarEnlace";

/** Detalles de la reunión: enlace para invitar y cómo funciona la conexión. */
export function PanelInfo() {
  const sala = useReunion((estado) => estado.sala);
  const [sonidos, setSonidos] = useState(sonidosActivados);
  return (
    <div className="flex-1 overflow-y-auto px-6 pb-6 text-sm text-gray-700">
      <h3 className="font-medium text-gray-900">Información para unirse</h3>
      <p className="mt-1 break-all text-gray-600">{typeof window !== "undefined" ? `${window.location.origin}/${sala}` : sala}</p>
      <div className="mt-3">
        <BotonCopiarEnlace />
      </div>
      <hr className="my-6 border-gray-200" />
      <label className="flex cursor-pointer items-center justify-between gap-4">
        <span>
          <span className="block font-medium text-gray-900">Sonido de arpa</span>
          <span className="text-gray-600">Agudo cuando alguien entra, grave cuando sale</span>
        </span>
        <input
          type="checkbox"
          checked={sonidos}
          onChange={(evento) => {
            const activos = evento.target.checked;
            fijarSonidos(activos);
            setSonidos(activos);
            if (activos) {
              prepararSonidos();
              sonarEntrada();
            }
          }}
          className="h-5 w-5 accent-acento-fuerte"
        />
      </label>
      <hr className="my-6 border-gray-200" />
      <h3 className="font-medium text-gray-900">Cómo viaja tu vídeo</h3>
      <p className="mt-1 leading-relaxed text-gray-600">
        Cada persona envía su audio y vídeo, cifrados, al servidor de esta reunión (el equipo de quien la organiza), que los reenvía a las demás. Solo descargas el
        vídeo de quien ves en pantalla. Si una red no permite la conexión directa, el tráfico pasa cifrado por un relé TURN que no puede ver el contenido.
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
