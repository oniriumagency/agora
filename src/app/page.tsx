"use client";
import { useEffect, useState } from "react";
import { Inicio } from "@/componentes/inicio/Inicio";
import { PaginaReunion } from "@/componentes/PaginaReunion";
import { interpretarCodigo } from "@/utilidades/codigoSala";

/**
 * Única página de la web (exportación estática que sirve el servidor). La ruta decide: "/" es el
 * inicio y "/abc-defg-hij" una reunión; el servidor devuelve esta misma página para cualquier ruta.
 */
export default function Raiz() {
  const [ruta, setRuta] = useState<string | null>(null);
  useEffect(() => setRuta(decodeURIComponent(window.location.pathname)), []);

  if (ruta === null) return null;
  if (ruta === "/" || ruta === "") return <Inicio />;
  const codigo = interpretarCodigo(ruta.replace(/^\//, ""));
  if (!codigo) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl">Ese enlace de reunión no es válido</h1>
        <a href="/" className="rounded-md bg-acento-fuerte px-4 py-2 font-medium text-white">
          Volver al inicio
        </a>
      </div>
    );
  }
  return <PaginaReunion codigo={codigo} />;
}
