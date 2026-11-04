"use client";
import { useEffect, useState } from "react";
import { formatearBytes, obtenerArchivo } from "@/red/archivos";
import type { ArchivoChat } from "@/red/protocolo";
import { IconoArchivo, IconoDescargar } from "../comunes/Iconos";

/** Archivo del chat. Llega cifrado: la vista previa y la descarga se descifran en el navegador. */
export function TarjetaArchivo({ archivo }: { archivo: ArchivoChat }) {
  const [vista, setVista] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bajando, setBajando] = useState(false);

  useEffect(() => {
    if (!archivo.vistaPrevia) return;
    let url: string | null = null;
    let vigente = true;
    obtenerArchivo(archivo.id, archivo.tipo).then(
      (blob) => {
        if (!vigente) return;
        url = URL.createObjectURL(blob);
        setVista(url);
      },
      () => undefined,
    );
    return () => {
      vigente = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [archivo.id, archivo.tipo, archivo.vistaPrevia]);

  async function descargar() {
    setBajando(true);
    setError(null);
    try {
      const url = URL.createObjectURL(await obtenerArchivo(archivo.id, archivo.tipo));
      const enlace = Object.assign(document.createElement("a"), { href: url, download: archivo.nombre });
      enlace.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo descargar.");
    } finally {
      setBajando(false);
    }
  }

  return (
    <div className="mt-1.5 overflow-hidden rounded-xl border border-gray-200">
      {vista && (
        <button onClick={() => void descargar()} className="block w-full bg-gray-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={vista} alt={archivo.nombre} className="max-h-56 w-full object-contain" />
        </button>
      )}
      <div className="flex items-center gap-3 px-3 py-2">
        <IconoArchivo tam={20} className="shrink-0 text-gray-500" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-gray-900" title={archivo.nombre}>{archivo.nombre}</p>
          <p className={`text-xs ${error ? "text-peligro-fuerte" : "text-gray-500"}`}>{error ?? formatearBytes(archivo.tamano)}</p>
        </div>
        <button
          onClick={() => void descargar()}
          disabled={bajando}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-acento-fuerte hover:bg-gray-100 disabled:opacity-50"
          aria-label={`Descargar ${archivo.nombre}`}
          title="Descargar"
        >
          <IconoDescargar tam={20} />
        </button>
      </div>
    </div>
  );
}
