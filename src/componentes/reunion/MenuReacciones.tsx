"use client";
import { useEffect, useRef, useState } from "react";
import { reaccionar } from "@/estado/controlesLocales";
import { REACCIONES } from "@/red/protocolo";
import { IconoEmoji } from "../comunes/Iconos";
import { BotonControl } from "./BotonControl";

/** Botón de reacciones con su bandeja de emojis (se cierra al pulsar fuera o con Escape). */
export function MenuReacciones() {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const cerrarFuera = (evento: PointerEvent) => {
      if (!raiz.current?.contains(evento.target as Node)) setAbierto(false);
    };
    const cerrarEscape = (evento: KeyboardEvent) => evento.key === "Escape" && setAbierto(false);
    document.addEventListener("pointerdown", cerrarFuera);
    document.addEventListener("keydown", cerrarEscape);
    return () => {
      document.removeEventListener("pointerdown", cerrarFuera);
      document.removeEventListener("keydown", cerrarEscape);
    };
  }, [abierto]);

  return (
    <div ref={raiz} className="relative">
      <BotonControl variante={abierto ? "activo" : "normal"} etiqueta="Enviar una reacción" onClick={() => setAbierto(!abierto)} presionado={abierto}>
        <IconoEmoji />
      </BotonControl>
      {abierto && (
        <div className="absolute bottom-full left-1/2 mb-3 flex -translate-x-1/2 gap-1 rounded-full bg-sala-superficie p-1.5 shadow-xl animate-aparecer">
          {REACCIONES.map((emoji) => (
            <button key={emoji} onClick={() => reaccionar(emoji)} className="flex h-10 w-10 items-center justify-center rounded-full text-2xl transition hover:scale-110 hover:bg-white/10" aria-label={`Reaccionar con ${emoji}`}>
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
