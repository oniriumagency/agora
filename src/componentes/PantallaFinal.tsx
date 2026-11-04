"use client";
import { useReunion } from "@/estado/useReunion";
import { Logo } from "./comunes/Logo";

/** Tras colgar o ante un error: volver a entrar o ir al inicio. */
export function PantallaFinal({ codigo }: { codigo: string }) {
  const { fase, error, fijar } = useReunion();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="px-6 py-3">
        <Logo />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
        <h1 className="text-3xl">{fase === "error" ? "No se pudo continuar en la reunión" : "Saliste de la reunión"}</h1>
        {error && <p className="max-w-md text-gray-600">{error}</p>}
        <div className="flex gap-3">
          <button onClick={() => fijar({ fase: "previa", error: null, sala: codigo })} className="rounded-md border border-gray-300 px-5 py-2.5 font-medium text-acento-fuerte hover:bg-blue-50">
            Volver a unirse
          </button>
          <a href="/" className="rounded-md bg-acento-fuerte px-5 py-2.5 font-medium text-white hover:bg-[#1765cc]">
            Volver a la pantalla principal
          </a>
        </div>
      </main>
    </div>
  );
}
