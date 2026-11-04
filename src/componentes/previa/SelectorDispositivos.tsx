"use client";
import { useEffect, useState } from "react";
import { dispositivosElegidos, elegirDispositivo } from "@/estado/controlesLocales";
import { useReunion } from "@/estado/useReunion";
import { listarDispositivos } from "@/medios/mediosLocales";
import { IconoCamara, IconoMicro } from "../comunes/Iconos";

/** Selectores de micrófono y cámara. La lista se refresca al conceder permisos o conectar equipos. */
export function SelectorDispositivos({ oscuro = false }: { oscuro?: boolean }) {
  const [listas, setListas] = useState<{ microfonos: MediaDeviceInfo[]; camaras: MediaDeviceInfo[] }>({ microfonos: [], camaras: [] });
  const pistaMicro = useReunion((estado) => estado.local.pistaMicro);
  const flujoCamara = useReunion((estado) => estado.local.flujoCamara);

  useEffect(() => {
    const refrescar = () => void listarDispositivos().then(setListas);
    refrescar();
    navigator.mediaDevices?.addEventListener("devicechange", refrescar);
    return () => navigator.mediaDevices?.removeEventListener("devicechange", refrescar);
  }, [pistaMicro, flujoCamara]);

  const elegidos = dispositivosElegidos();
  const actualMicro = elegidos.microfonoId ?? pistaMicro?.getSettings().deviceId ?? "";
  const actualCamara = elegidos.camaraId ?? flujoCamara?.getVideoTracks()[0]?.getSettings().deviceId ?? "";
  const estilo = oscuro
    ? "border-sala-borde bg-sala-superficie text-sala-texto"
    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50";

  const selector = (tipo: "microfono" | "camara", opciones: MediaDeviceInfo[], actual: string) => (
    <label className={`flex min-w-0 flex-1 items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${estilo}`}>
      {tipo === "microfono" ? <IconoMicro tam={18} className="shrink-0" /> : <IconoCamara tam={18} className="shrink-0" />}
      <select
        value={actual}
        onChange={(evento) => void elegirDispositivo(tipo, evento.target.value)}
        aria-label={tipo === "microfono" ? "Micrófono" : "Cámara"}
        className="min-w-0 flex-1 truncate bg-transparent outline-none"
      >
        {opciones.length === 0 && <option value="">{tipo === "microfono" ? "Sin micrófonos" : "Sin cámaras"}</option>}
        {opciones.map((dispositivo, indice) => (
          <option key={dispositivo.deviceId} value={dispositivo.deviceId} className="text-gray-900">
            {dispositivo.label || `${tipo === "microfono" ? "Micrófono" : "Cámara"} ${indice + 1}`}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
      {selector("microfono", listas.microfonos, actualMicro)}
      {selector("camara", listas.camaras, actualCamara)}
    </div>
  );
}
