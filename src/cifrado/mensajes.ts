import type { ArchivoChat, MensajeChat, MensajeServidor, Participante } from "@/red/protocolo";
import { descifrarTexto } from "./claves";

/**
 * Descifra lo que llega del servidor antes de que lo vea la interfaz: nombres, chat y nombres de
 * archivo viajan cifrados con la clave de la reunión, así que el servidor nunca los conoce.
 */
const TIPOS_CON_VISTA = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

const nombre = (cifrado: string) => descifrarTexto(cifrado, "Sin clave");

async function participante(p: Participante): Promise<Participante> {
  return { ...p, nombre: await nombre(p.nombre) };
}

async function archivo(a: ArchivoChat): Promise<ArchivoChat> {
  try {
    const { n, t } = JSON.parse(await descifrarTexto(a.nombre, "{}")) as { n?: string; t?: string };
    const tipo = t || "application/octet-stream";
    return { ...a, nombre: n || "archivo", tipo, vistaPrevia: TIPOS_CON_VISTA.has(tipo) };
  } catch {
    return { ...a, nombre: "🔒 Archivo ilegible", vistaPrevia: false };
  }
}

async function chat(m: MensajeChat): Promise<MensajeChat> {
  return {
    ...m,
    autorNombre: await nombre(m.autorNombre),
    texto: m.texto ? await descifrarTexto(m.texto) : "",
    archivo: m.archivo ? await archivo(m.archivo) : undefined,
  };
}

export async function descifrarMensaje(m: MensajeServidor): Promise<MensajeServidor> {
  switch (m.tipo) {
    case "BIENVENIDA":
      return { ...m, participantes: await Promise.all(m.participantes.map(participante)), chat: await Promise.all(m.chat.map(chat)) };
    case "ENTRO":
      return { ...m, participante: await participante(m.participante) };
    case "CHAT":
      return { ...m, mensaje: await chat(m.mensaje) };
    case "VOZ":
      return { ...m, nombre: await nombre(m.nombre) };
    case "SILENCIADO":
    case "EXPULSADO":
      return { ...m, por: await nombre(m.por) };
    default:
      return m;
  }
}

/** Entrega los mensajes en orden aunque descifrarlos lleve un momento. */
export function enOrden(alRecibir: (m: MensajeServidor) => void): (m: MensajeServidor) => void {
  let cola = Promise.resolve();
  return (m) => {
    cola = cola.then(() => descifrarMensaje(m)).then(alRecibir, (error) => console.error("[Cifrado]", error));
  };
}
