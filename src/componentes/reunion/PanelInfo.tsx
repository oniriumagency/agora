"use client";
import { useState } from "react";
import { useReunion } from "@/estado/useReunion";
import { ESPERAS_BOLSILLO, esIPhone, esperaBolsillo, fijarEsperaBolsillo } from "./ModoBolsillo";
import { fijarSonidos, prepararSonidos, sonarEntrada, sonidosActivados } from "@/medios/sonidos";
import { BotonCopiarEnlace } from "./BotonCopiarEnlace";
import { secretoDe } from "@/cifrado/secretoSala";

/** Detalles de la reunión: enlace para invitar y cómo funciona la conexión. */
export function PanelInfo() {
  const sala = useReunion((estado) => estado.sala);
  const [sonidos, setSonidos] = useState(sonidosActivados);
  const [espera, setEspera] = useState(esperaBolsillo);
  const [verClave, setVerClave] = useState(false);
  const iphone = typeof window !== "undefined" && esIPhone();
  return (
    <div className="flex-1 overflow-y-auto px-6 pb-6 text-sm text-gray-700">
      <h3 className="font-medium text-gray-900">Información para unirse</h3>
      <p className="mt-1 break-all text-gray-600">{typeof window !== "undefined" ? `${window.location.origin}/${sala}` : sala}</p>
      <p className="mt-1 text-gray-600">
        Clave: <span className="font-mono">{verClave ? secretoDe(sala) : "••••••••"}</span>{" "}
        <button onClick={() => setVerClave(!verClave)} className="text-acento-fuerte hover:underline">
          {verClave ? "Ocultar" : "Mostrar"}
        </button>
      </p>
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
      {iphone && (
        <label className="mt-5 flex items-center justify-between gap-4">
          <span>
            <span className="block font-medium text-gray-900">Pantalla en negro (solo audio)</span>
            <span className="text-gray-600">El iPhone no puede bloquearse sin cortar la llamada: la pantalla se pone en negro tras</span>
          </span>
          <select
            value={espera}
            onChange={(evento) => {
              const segundos = Number(evento.target.value);
              fijarEsperaBolsillo(segundos);
              setEspera(segundos);
            }}
            className="rounded-md border border-gray-300 bg-white px-2 py-1"
          >
            {ESPERAS_BOLSILLO.map((s) => (
              <option key={s} value={s}>
                {s < 60 ? `${s} s` : `${s / 60} min`}
              </option>
            ))}
          </select>
        </label>
      )}
      <hr className="my-6 border-gray-200" />
      <h3 className="font-medium text-gray-900">Cifrado de extremo a extremo</h3>
      <p className="mt-1 leading-relaxed text-gray-600">
        El audio, el vídeo, el chat, los archivos y los nombres se cifran en tu navegador con la clave de la reunión, que va en el enlace tras el «#» y nunca llega al
        servidor. El servidor (y el túnel o el relé TURN, si los hay) solo reenvía datos que no puede leer. Quien tenga el enlace completo puede entrar: compártelo
        solo con quien quieras en la reunión.
      </p>
      <p className="mt-2 leading-relaxed text-gray-600">
        Para que quien pierde la conexión pueda escuchar lo que se perdió, el servidor guarda en memoria el audio cifrado de los últimos 30 segundos (y hasta 3
        minutos mientras alguien está desconectado). Nunca se graba en disco y se descarta solo.
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
