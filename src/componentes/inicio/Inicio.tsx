"use client";
import { useEffect, useState, type FormEvent } from "react";
import { IconoTeclado, IconoVideoNuevo } from "@/componentes/comunes/Iconos";
import { Greca, Logo } from "@/componentes/comunes/Logo";
import { Ilustracion } from "./Ilustracion";
import { enlaceDeSala, generarCodigoSala, interpretarCodigo, secretoDeEnlace } from "@/utilidades/codigoSala";
import { generarSecreto } from "@/cifrado/claves";

const MINIMO_CONTRASENA = 8;

/** Página de inicio: crear una reunión nueva o unirse con un código o enlace. */
export function Inicio() {
  const [entrada, setEntrada] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hora, setHora] = useState("");
  const [propia, setPropia] = useState(false);
  const [contrasena, setContrasena] = useState("");

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
    window.location.assign(enlaceDeSala(codigo, secretoDeEnlace(entrada)));
  }

  /** Cada reunión nueva lleva su clave de cifrado (generada, o la contraseña que elijas). */
  function nuevaReunion() {
    if (propia && contrasena.trim().length < MINIMO_CONTRASENA) return setError(`La contraseña debe tener al menos ${MINIMO_CONTRASENA} caracteres.`);
    window.location.assign(enlaceDeSala(generarCodigoSala(), propia ? contrasena.trim() : generarSecreto()));
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-4 py-3 sm:px-6">
        <Logo />
        <span className="hidden text-lg text-gray-600 sm:block first-letter:uppercase">{hora}</span>
      </header>
      <Greca className="text-oro/70" />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center gap-12 px-6 py-10 lg:flex-row lg:gap-16">
        <section className="max-w-xl flex-1 text-center lg:text-left">
          <p className="font-marca text-sm font-semibold uppercase tracking-[0.3em] text-oro-hondo">La plaza de tu equipo</p>
          <h1 className="mt-3 text-4xl font-normal leading-tight text-gray-900 sm:text-[44px]">Reúnete, conversa y decide, como en el ágora</h1>
          <p className="mt-4 text-lg text-gray-600">
            Videollamadas en tu propio servidor y cifradas de extremo a extremo: ni el servidor ni la red ven el audio, el vídeo, el chat ni los archivos. Comparte el enlace y empieza.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row lg:items-start">
            <button
              onClick={nuevaReunion}
              className="flex h-12 items-center gap-2 rounded-md bg-acento-fuerte px-4 font-medium text-white shadow-sm transition hover:bg-acento-hondo hover:shadow-md"
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
              <button disabled={!entrada.trim()} className="h-12 rounded-md px-3 font-medium text-acento-fuerte transition hover:bg-acento-suave/50 disabled:text-gray-400 disabled:hover:bg-transparent">
                Unirse
              </button>
            </form>
          </div>
          {error && <p className="mt-3 text-sm text-peligro-fuerte">{error}</p>}
          <div className="mt-4 text-sm text-gray-600">
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={propia} onChange={(evento) => setPropia(evento.target.checked)} className="h-4 w-4 accent-acento-fuerte" />
              Elegir una contraseña propia para la nueva reunión
            </label>
            {propia && (
              <input
                value={contrasena}
                onChange={(evento) => {
                  setContrasena(evento.target.value);
                  setError(null);
                }}
                type="password"
                autoComplete="new-password"
                placeholder={`Al menos ${MINIMO_CONTRASENA} caracteres`}
                aria-label="Contraseña de la nueva reunión"
                className="mt-2 block h-10 w-full max-w-xs rounded-md border border-gray-400 px-3 outline-none focus:border-acento-fuerte"
              />
            )}
          </div>
          <hr className="mt-10 border-gray-200" />
          <p className="mt-4 text-sm text-gray-500">Cámara, micrófono, chat con archivos, mano alzada, reacciones y pantalla compartida.</p>
        </section>
        <Ilustracion />
      </main>
    </div>
  );
}
