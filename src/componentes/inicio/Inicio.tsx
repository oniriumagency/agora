"use client";
import { useEffect, useState, type FormEvent } from "react";
import { IconoTeclado, IconoVideoNuevo } from "@/componentes/comunes/Iconos";
import { Logo } from "@/componentes/comunes/Logo";
import { Ilustracion } from "./Ilustracion";
import { generarCodigoSala, interpretarCodigo } from "@/utilidades/codigoSala";

/** Página de inicio: crear una reunión nueva o unirse con un código o enlace. */
export function Inicio() {
  const [entrada, setEntrada] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hora, setHora] = useState("");

  useEffect(() => {
    const formato = new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit", weekday: "short", day: "numeric", month: "short" });
    const actualizar = () => setHora(formato.format(new Date()));
    actualizar();
    const temporizador = setInterval(actualizar, 15_000);
    return () => clearInterval(temporizador);
  }, []);

  function unirse(evento: FormEvent) {
    evento.preventDefault();
    const codigo = interpretarCodigo(entrada);
    if (!codigo) return setError("Ese código no es válido. Tiene la forma abc-defg-hij.");
    window.location.assign(`/${codigo}`);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-4 py-3 sm:px-6">
        <Logo />
        <span className="hidden text-lg text-gray-600 sm:block first-letter:uppercase">{hora}</span>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center gap-12 px-6 py-10 lg:flex-row lg:gap-16">
        <section className="max-w-xl flex-1 text-center lg:text-left">
          <h1 className="text-4xl font-normal leading-tight text-gray-900 sm:text-[44px]">Reuniones por vídeo, directas y privadas</h1>
          <p className="mt-4 text-lg text-gray-600">
            Tu propio servidor de reuniones: el audio y el vídeo pasan solo por el equipo que lo aloja, no por terceros. Comparte el enlace y empieza.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row lg:items-start">
            <button
              onClick={() => window.location.assign(`/${generarCodigoSala()}`)}
              className="flex h-12 items-center gap-2 rounded-md bg-acento-fuerte px-4 font-medium text-white shadow-sm transition hover:bg-[#1765cc] hover:shadow-md"
            >
              <IconoVideoNuevo tam={20} /> Nueva reunión
            </button>
            <form onSubmit={unirse} className="flex items-center gap-2">
              <label className="flex h-12 items-center gap-3 rounded-md border border-gray-400 px-3 focus-within:border-acento-fuerte focus-within:ring-1 focus-within:ring-acento-fuerte">
                <IconoTeclado tam={20} className="text-gray-600" />
                <input
                  value={entrada}
                  onChange={(evento) => {
                    setEntrada(evento.target.value);
                    setError(null);
                  }}
                  placeholder="Código o enlace"
                  aria-label="Código o enlace de la reunión"
                  className="w-44 bg-transparent text-base outline-none placeholder:text-gray-500"
                />
              </label>
              <button disabled={!entrada.trim()} className="h-12 rounded-md px-3 font-medium text-acento-fuerte transition hover:bg-blue-50 disabled:text-gray-400 disabled:hover:bg-transparent">
                Unirse
              </button>
            </form>
          </div>
          {error && <p className="mt-3 text-sm text-peligro-fuerte">{error}</p>}
          <hr className="mt-10 border-gray-200" />
          <p className="mt-4 text-sm text-gray-500">Cámara, micrófono, chat, mano alzada, reacciones y pantalla compartida.</p>
        </section>
        <Ilustracion />
      </main>
    </div>
  );
}
