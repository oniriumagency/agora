"use client";
import { useEffect, useState } from "react";

/** Hora actual (HH:MM) para la barra inferior. */
export function Reloj() {
  const [hora, setHora] = useState("");
  useEffect(() => {
    const formato = new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" });
    const actualizar = () => setHora(formato.format(new Date()));
    actualizar();
    const temporizador = setInterval(actualizar, 10_000);
    return () => clearInterval(temporizador);
  }, []);
  return <span className="tabular-nums">{hora}</span>;
}
