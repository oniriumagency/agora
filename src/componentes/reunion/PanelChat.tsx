"use client";
import { Fragment, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { enviarChat } from "@/estado/controlesLocales";
import { useReunion } from "@/estado/useReunion";
import { LARGO_MAXIMO_CHAT } from "@/red/protocolo";
import { IconoEnviar } from "../comunes/Iconos";
import { TextoConEnlaces } from "./TextoConEnlaces";

/** Chat de la reunión. Los mensajes consecutivos del mismo autor se agrupan bajo una cabecera. */
const formatoHora = new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" });
const AGRUPAR_MS = 5 * 60_000;

export function PanelChat() {
  const chat = useReunion((estado) => estado.chat);
  const miId = useReunion((estado) => estado.miId);
  const [texto, setTexto] = useState("");
  const final = useRef<HTMLDivElement>(null);

  useEffect(() => {
    final.current?.scrollIntoView({ block: "end" });
  }, [chat.length]);

  function enviar(evento?: FormEvent) {
    evento?.preventDefault();
    if (!texto.trim()) return;
    enviarChat(texto);
    setTexto("");
  }

  function alTeclear(evento: KeyboardEvent<HTMLTextAreaElement>) {
    if (evento.key === "Enter" && !evento.shiftKey) {
      evento.preventDefault();
      enviar();
    }
  }

  return (
    <>
      <p className="mx-3 rounded-lg bg-gray-100 px-4 py-3 text-xs leading-relaxed text-gray-600">
        Los mensajes solo los ven las personas que están en la llamada y se borran cuando todas salen.
      </p>
      <div className="desplazable flex-1 overflow-y-auto px-6 py-3" role="log" aria-live="polite">
        {chat.map((mensaje, indice) => {
          const anterior = chat[indice - 1];
          const nuevoGrupo = !anterior || anterior.autorId !== mensaje.autorId || mensaje.enviadoEn - anterior.enviadoEn > AGRUPAR_MS;
          return (
            <Fragment key={mensaje.id}>
              {nuevoGrupo && (
                <p className="mt-4 text-[13px]">
                  <span className="font-medium text-gray-900">{mensaje.autorId === miId ? "Tú" : mensaje.autorNombre}</span>
                  <span className="ml-2 text-gray-500">{formatoHora.format(mensaje.enviadoEn)}</span>
                </p>
              )}
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-800">
                <TextoConEnlaces texto={mensaje.texto} />
              </p>
            </Fragment>
          );
        })}
        <div ref={final} />
      </div>
      <form onSubmit={enviar} className="m-3 flex items-end gap-1 rounded-3xl bg-gray-100 py-1 pl-4 pr-1">
        <textarea
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          onKeyDown={alTeclear}
          maxLength={LARGO_MAXIMO_CHAT}
          rows={1}
          placeholder="Enviar un mensaje"
          aria-label="Escribe un mensaje para todos"
          autoFocus
          className="max-h-32 flex-1 resize-none bg-transparent py-2.5 text-sm outline-none placeholder:text-gray-500"
        />
        <button disabled={!texto.trim()} className="flex h-10 w-10 items-center justify-center rounded-full text-acento-fuerte hover:bg-gray-200 disabled:text-gray-400 disabled:hover:bg-transparent" aria-label="Enviar mensaje">
          <IconoEnviar tam={20} />
        </button>
      </form>
    </>
  );
}
