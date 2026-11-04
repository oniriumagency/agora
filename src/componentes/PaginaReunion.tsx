"use client";
import { useEffect, useState } from "react";
import { abandonarPagina } from "@/estado/sesion";
import { tomarSecretoDeUrl } from "@/cifrado/secretoSala";
import { useReunion } from "@/estado/useReunion";
import { SalaEspera } from "./previa/SalaEspera";
import { Reunion } from "./reunion/Reunion";
import { PantallaFinal } from "./PantallaFinal";

/** Elige la pantalla según la fase: sala de espera, reunión o final (salida o error). */
export function PaginaReunion({ codigo }: { codigo: string }) {
  const fase = useReunion((estado) => estado.fase);
  // Antes de pintar nada: la clave sale de la URL (y de la vista) y queda en esta pestaña
  useState(() => tomarSecretoDeUrl(codigo));

  useEffect(() => {
    useReunion.getState().fijar({ fase: "previa", sala: codigo, error: null });
    return () => abandonarPagina();
  }, [codigo]);

  useEffect(() => {
    if (fase !== "reunion" && fase !== "reconectando") return;
    // Aviso del navegador si se cierra la pestaña sin colgar
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [fase]);

  if (fase === "previa") return <SalaEspera codigo={codigo} />;
  if (fase === "fuera" || fase === "error") return <PantallaFinal codigo={codigo} />;
  return <Reunion />;
}
