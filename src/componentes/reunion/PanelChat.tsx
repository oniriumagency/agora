"use client";
import { Fragment, useEffect, useRef, useState, type DragEvent, type FormEvent, type KeyboardEvent } from "react";
import { enviarChat } from "@/estado/controlesLocales";
import { useReunion } from "@/estado/useReunion";
import { LARGO_MAXIMO_CHAT } from "@/red/protocolo";
import { subirArchivo } from "@/red/archivos";
import { TarjetaArchivo } from "./TarjetaArchivo";
import { IconoCerrar, IconoClip, IconoEnviar } from "../comunes/Iconos";
import { TextoConEnlaces } from "./TextoConEnlaces";

/** Chat de la reunión. Los mensajes consecutivos del mismo autor se agrupan bajo una cabecera. */
const formatoHora = new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" });
const AGRUPAR_MS = 5 * 60_000;

interface Subida {
  id: number;
  nombre: string;
  tamano: number;
  progreso: number;
  error: string | null;
  cancelar: () => void;
}

let siguienteSubida = 1;

export function PanelChat() {
  const chat = useReunion((estado) => estado.chat);
  const miId = useReunion((estado) => estado.miId);
  const clave = useReunion((estado) => estado.clave);
  const maximoMB = useReunion((estado) => estado.maximoArchivoMB);
  const [texto, setTexto] = useState("");
  const [subidas, setSubidas] = useState<Subida[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const final = useRef<HTMLDivElement>(null);
  const selector = useRef<HTMLInputElement>(null);

  useEffect(() => {
    final.current?.scrollIntoView({ block: "end" });
  }, [chat.length, subidas.length]);

  function cambiarSubida(id: number, cambios: Partial<Subida>) {
    setSubidas((actuales) => actuales.map((s) => (s.id === id ? { ...s, ...cambios } : s)));
  }
  function quitarSubida(id: number) {
    setSubidas((actuales) => actuales.filter((s) => s.id !== id));
  }

  function enviarArchivos(lista: FileList | null) {
    if (!lista || !clave) return;
    for (const archivo of Array.from(lista)) {
      const id = siguienteSubida++;
      if (archivo.size > maximoMB * 1024 * 1024) {
        setSubidas((a) => [...a, { id, nombre: archivo.name, tamano: archivo.size, progreso: 0, error: `Supera el máximo de ${maximoMB} MB`, cancelar: () => {} }]);
        continue;
      }
      const { promesa, cancelar } = subirArchivo(archivo, clave, (progreso) => cambiarSubida(id, { progreso }));
      setSubidas((a) => [...a, { id, nombre: archivo.name, tamano: archivo.size, progreso: 0, error: null, cancelar }]);
      promesa.then(
        () => quitarSubida(id),
        (error: Error) => (error.message === "Cancelado" ? quitarSubida(id) : cambiarSubida(id, { error: error.message })),
      );
    }
  }

  function alSoltar(evento: DragEvent) {
    evento.preventDefault();
    setArrastrando(false);
    enviarArchivos(evento.dataTransfer.files);
  }

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
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onDragOver={(evento) => {
        if (evento.dataTransfer.types.includes("Files")) {
          evento.preventDefault();
          setArrastrando(true);
        }
      }}
      onDragLeave={(evento) => {
        if (!evento.currentTarget.contains(evento.relatedTarget as Node)) setArrastrando(false);
      }}
      onDrop={alSoltar}
    >
      {arrastrando && (
        <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-acento bg-white/90 text-sm font-medium text-acento-fuerte">
          Suelta para enviar a todos
        </div>
      )}
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
              {mensaje.archivo ? (
                <TarjetaArchivo archivo={mensaje.archivo} />
              ) : (
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-800">
                  <TextoConEnlaces texto={mensaje.texto} />
                </p>
              )}
            </Fragment>
          );
        })}
        {subidas.map((subida) => (
          <div key={subida.id} className="mt-3 rounded-xl border border-gray-200 px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-gray-800">{subida.nombre}</span>
              <span className="shrink-0 text-xs text-gray-500">{subida.error ? "" : `${Math.round(subida.progreso * 100)} %`}</span>
              <button
                onClick={() => (subida.error ? quitarSubida(subida.id) : subida.cancelar())}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
                aria-label={subida.error ? "Descartar" : "Cancelar envío"}
              >
                <IconoCerrar tam={16} />
              </button>
            </div>
            {subida.error ? (
              <p className="mt-1 text-xs text-red-600">{subida.error}</p>
            ) : (
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-gray-200">
                <div className="h-full bg-acento transition-[width]" style={{ width: `${subida.progreso * 100}%` }} />
              </div>
            )}
          </div>
        ))}
        <div ref={final} />
      </div>
      <form onSubmit={enviar} className="m-3 flex items-end gap-1 rounded-3xl bg-gray-100 py-1 pl-1 pr-1">
        <input
          ref={selector}
          type="file"
          multiple
          hidden
          onChange={(evento) => {
            enviarArchivos(evento.target.files);
            evento.target.value = ""; // permite volver a elegir el mismo archivo
          }}
        />
        <button
          type="button"
          onClick={() => selector.current?.click()}
          disabled={!clave}
          title={`Adjuntar archivo (máx. ${maximoMB} MB)`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-600 hover:bg-gray-200 disabled:text-gray-400"
          aria-label="Adjuntar archivo"
        >
          <IconoClip tam={20} />
        </button>
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
    </div>
  );
}
