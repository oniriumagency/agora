"use client";
import { useState } from "react";
import { useReunion } from "@/estado/useReunion";
import { enlaceDeSala } from "@/utilidades/codigoSala";
import { IconoCopiar } from "../comunes/Iconos";

/** Copia el enlace de la reunión al portapapeles y confirma durante unos segundos. */
export function BotonCopiarEnlace({ oscuro = false }: { oscuro?: boolean }) {
  const sala = useReunion((estado) => estado.sala);
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlaceDeSala(sala));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      window.prompt("Copia el enlace de la reunión:", enlaceDeSala(sala));
    }
  }

  return (
    <button
      onClick={() => void copiar()}
      className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium ${oscuro ? "text-acento hover:bg-white/10" : "text-acento-fuerte hover:bg-blue-50"}`}
    >
      <IconoCopiar tam={18} /> {copiado ? "Enlace copiado" : "Copiar enlace de la reunión"}
    </button>
  );
}
