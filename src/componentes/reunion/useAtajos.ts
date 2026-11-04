import { useEffect } from "react";
import { alternarCamara, alternarMano, alternarMicrofono } from "@/estado/controlesLocales";
import { useReunion } from "@/estado/useReunion";

/** Atajos de teclado: Ctrl+D micrófono, Ctrl+E cámara, Ctrl+Alt+H mano, Ctrl+Alt+C chat. */
export function useAtajos(): void {
  useEffect(() => {
    function alPulsar(evento: KeyboardEvent) {
      if (!(evento.ctrlKey || evento.metaKey)) return;
      const tecla = evento.key.toLowerCase();
      const accion =
        !evento.altKey && tecla === "d" ? () => void alternarMicrofono()
        : !evento.altKey && tecla === "e" ? () => void alternarCamara()
        : evento.altKey && evento.code === "KeyH" ? alternarMano
        : evento.altKey && evento.code === "KeyC" ? () => useReunion.getState().abrirPanel("chat")
        : null;
      if (!accion) return;
      evento.preventDefault();
      accion();
    }
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, []);
}
