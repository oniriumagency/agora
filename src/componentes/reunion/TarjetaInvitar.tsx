"use client";
import { useState } from "react";
import { useReunion } from "@/estado/useReunion";
import { IconoCerrar } from "../comunes/Iconos";
import { BotonCopiarEnlace } from "./BotonCopiarEnlace";

/** Tarjeta que aparece mientras estás a solas en la reunión, para compartir el enlace. */
export function TarjetaInvitar() {
  const sala = useReunion((estado) => estado.sala);
  const solo = useReunion((estado) => estado.fase === "reunion" && Object.keys(estado.participantes).length === 0);
  const [descartada, setDescartada] = useState(false);
  if (!solo || descartada) return null;

  return (
    <div className="fixed bottom-24 left-4 z-30 w-[min(360px,calc(100vw-2rem))] rounded-xl bg-white p-5 text-gray-900 shadow-2xl animate-aparecer">
      <div className="flex items-start justify-between">
        <h2 className="text-lg">Tu reunión está lista</h2>
        <button onClick={() => setDescartada(true)} className="-mr-2 -mt-2 flex h-9 w-9 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100" aria-label="Cerrar">
          <IconoCerrar tam={20} />
        </button>
      </div>
      <p className="mt-2 text-sm text-gray-600">Comparte este enlace con las personas que quieras en la reunión.</p>
      <p className="mt-3 truncate rounded-md bg-gray-100 px-3 py-2.5 font-mono text-sm text-gray-800">
        {typeof window !== "undefined" ? window.location.host : ""}/{sala}
      </p>
      <div className="mt-2 -ml-3">
        <BotonCopiarEnlace />
      </div>
    </div>
  );
}
