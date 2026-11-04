"use client";
import { useEffect, useRef, useState } from "react";
import type { DatosTesela } from "@/estado/useTeselas";
import { Tesela } from "./Tesela";

/**
 * Mosaico de teselas que aprovecha al máximo el espacio disponible: prueba cada número de
 * columnas y se queda con el que da teselas más grandes.
 */
const HUECO = 12;

/** 16:9 en pantallas apaisadas; en vertical (móvil) teselas casi cuadradas para no apilar franjas finas. */
function calcularDistribucion(ancho: number, alto: number, cantidad: number): { anchoTesela: number; altoTesela: number } {
  const PROPORCION = ancho >= alto ? 16 / 9 : cantidad <= 2 ? 3 / 4 : 4 / 5;
  let mejor = { anchoTesela: 0, altoTesela: 0 };
  for (let columnas = 1; columnas <= cantidad; columnas++) {
    const filas = Math.ceil(cantidad / columnas);
    const anchoMaximo = (ancho - HUECO * (columnas - 1)) / columnas;
    const altoMaximo = (alto - HUECO * (filas - 1)) / filas;
    const anchoTesela = Math.min(anchoMaximo, altoMaximo * PROPORCION);
    if (anchoTesela > mejor.anchoTesela) mejor = { anchoTesela, altoTesela: anchoTesela / PROPORCION };
  }
  return mejor;
}

export function Mosaico({ teselas }: { teselas: DatosTesela[] }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [tam, setTam] = useState({ ancho: 0, alto: 0 });

  useEffect(() => {
    const elemento = contenedor.current;
    if (!elemento) return;
    const observador = new ResizeObserver(([entrada]) => setTam({ ancho: entrada.contentRect.width, alto: entrada.contentRect.height }));
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  const { anchoTesela, altoTesela } = calcularDistribucion(tam.ancho, tam.alto, Math.max(teselas.length, 1));
  const tamAvatar = Math.max(40, Math.min(120, altoTesela * 0.35));

  return (
    <div ref={contenedor} className="flex h-full w-full flex-wrap content-center items-center justify-center" style={{ gap: HUECO }}>
      {anchoTesela > 0 &&
        teselas.map((datos) => (
          <div key={datos.clave} style={{ width: anchoTesela, height: altoTesela }} className="animate-aparecer">
            <Tesela datos={datos} tamAvatar={tamAvatar} />
          </div>
        ))}
    </div>
  );
}
