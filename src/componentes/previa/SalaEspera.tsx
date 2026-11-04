"use client";
import { useEffect, useState, type FormEvent } from "react";
import { prepararPrevia } from "@/estado/controlesLocales";
import { entrar } from "@/estado/sesion";
import { prepararSonidos } from "@/medios/sonidos";
import { useReunion } from "@/estado/useReunion";
import { LARGO_MAXIMO_NOMBRE } from "@/red/protocolo";
import { Logo } from "../comunes/Logo";
import { Avisos } from "../reunion/Avisos";
import { SelectorDispositivos } from "./SelectorDispositivos";
import { VistaPrevia } from "./VistaPrevia";

/** Sala de espera: vista previa de cámara y micrófono, nombre y botón para entrar. */
const CLAVE_NOMBRE = "agora.nombre";
const CLAVE_PREFERENCIAS = "agora.medios";

function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

export function SalaEspera({ codigo }: { codigo: string }) {
  const [nombre, setNombre] = useState("");
  const [listo, setListo] = useState(false);
  const local = useReunion((estado) => estado.local);

  useEffect(() => {
    setNombre(leer(CLAVE_NOMBRE) ?? "");
    const preferencias = JSON.parse(leer(CLAVE_PREFERENCIAS) ?? "{}") as { microfono?: boolean; camara?: boolean };
    void prepararPrevia(preferencias.microfono ?? true, preferencias.camara ?? true).finally(() => setListo(true));
  }, []);

  function unirse(evento: FormEvent) {
    evento.preventDefault();
    const limpio = nombre.trim();
    if (!limpio) return;
    try {
      localStorage.setItem(CLAVE_NOMBRE, limpio);
      localStorage.setItem(CLAVE_PREFERENCIAS, JSON.stringify({ microfono: local.microfono, camara: local.camara }));
    } catch {
      /* sin almacenamiento: solo se pierde la comodidad de recordar */
    }
    prepararSonidos(); // el toque de "Unirse" habilita el audio de los avisos
    void entrar(codigo, limpio);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="px-4 py-3 sm:px-6">
        <Logo />
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-10 px-4 pb-10 lg:flex-row lg:gap-14">
        <div className="w-full max-w-[740px] flex-[3]">
          <VistaPrevia nombre={nombre.trim() || "Tú"} cargando={!listo} />
          <SelectorDispositivos />
        </div>
        <form onSubmit={unirse} className="flex w-full max-w-sm flex-[2] flex-col items-center gap-5 text-center">
          <h1 className="text-[28px] text-gray-900">¿Todo listo para unirte?</h1>
          <p className="font-mono text-sm text-gray-500">{codigo}</p>
          <input
            value={nombre}
            onChange={(evento) => setNombre(evento.target.value)}
            maxLength={LARGO_MAXIMO_NOMBRE}
            placeholder="¿Cuál es tu nombre?"
            aria-label="Tu nombre"
            autoFocus
            className="h-14 w-full rounded-md border border-gray-400 px-4 text-base outline-none focus:border-acento-fuerte focus:ring-1 focus:ring-acento-fuerte"
          />
          <button
            disabled={!nombre.trim()}
            className="h-12 w-full rounded-full bg-acento-fuerte px-6 font-medium text-white shadow-sm transition hover:bg-acento-hondo hover:shadow-md disabled:bg-gray-200 disabled:text-gray-500 disabled:shadow-none"
          >
            Unirse ahora
          </button>
        </form>
      </main>
      <Avisos />
    </div>
  );
}
