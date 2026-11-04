import type { IncomingMessage } from "node:http";
import type { WebSocket, WebSocketServer } from "ws";
import { configuracion } from "./entorno.ts";

/**
 * Protección de las conexiones (heredada de Kubox):
 * - Origen: con MEET_ORIGENES_PERMITIDOS solo se aceptan esos orígenes de navegador.
 * - Topes de conexiones globales y por IP. Tras un túnel todo llega desde 127.0.0.1, así que la
 *   IP solo cuenta si es remota o si MEET_CONFIAR_PROXY=true permite leer X-Forwarded-For.
 * - Límite de mensajes por socket en ventana fija; al superarlo se cierra el socket.
 * - Latido ping/pong: el socket que no responde se termina.
 */
const conexionesPorIp = new Map<string, number>();
let conexionesTotales = 0;

export type Veredicto = { admitida: true; claveIp: string | null } | { admitida: false; motivo: string };

function claveIp(solicitud: IncomingMessage): string | null {
  const reenvio = solicitud.headers["x-forwarded-for"];
  if (configuracion.confiarProxy && typeof reenvio === "string" && reenvio) return reenvio.split(",")[0].trim();
  const direccion = solicitud.socket.remoteAddress ?? "";
  return direccion && !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(direccion) ? direccion : null;
}

export function evaluarAdmision(solicitud: IncomingMessage): Veredicto {
  const { origenesPermitidos } = configuracion;
  if (origenesPermitidos.size > 0 && !origenesPermitidos.has(solicitud.headers.origin ?? "")) {
    return { admitida: false, motivo: `origen no permitido '${solicitud.headers.origin ?? "(ausente)"}'` };
  }
  if (conexionesTotales >= configuracion.maximoConexiones) return { admitida: false, motivo: "máximo de conexiones" };
  const ip = claveIp(solicitud);
  if (ip && (conexionesPorIp.get(ip) ?? 0) >= configuracion.maximoConexionesPorIp) {
    return { admitida: false, motivo: `máximo de conexiones para ${ip}` };
  }
  conexionesTotales++;
  if (ip) conexionesPorIp.set(ip, (conexionesPorIp.get(ip) ?? 0) + 1);
  return { admitida: true, claveIp: ip };
}

export function liberarConexion(ip: string | null): void {
  conexionesTotales = Math.max(conexionesTotales - 1, 0);
  if (!ip) return;
  const restantes = (conexionesPorIp.get(ip) ?? 1) - 1;
  if (restantes > 0) conexionesPorIp.set(ip, restantes);
  else conexionesPorIp.delete(ip);
}

const VENTANA_MS = 10_000;
const MAXIMO_POR_VENTANA = 300;

/** @returns función que registra un mensaje y devuelve false al superar el cupo de la ventana. */
export function crearLimitador(): () => boolean {
  let inicio = Date.now();
  let cuenta = 0;
  return () => {
    const ahora = Date.now();
    if (ahora - inicio > VENTANA_MS) {
      inicio = ahora;
      cuenta = 0;
    }
    return ++cuenta <= MAXIMO_POR_VENTANA;
  };
}

const vivos = new WeakSet<WebSocket>();

export function registrarLatido(socket: WebSocket): void {
  vivos.add(socket);
}

export function iniciarLatido(servidor: WebSocketServer, intervaloMs = 30_000): () => void {
  const temporizador = setInterval(() => {
    for (const socket of servidor.clients) {
      if (!vivos.has(socket)) {
        socket.terminate();
        continue;
      }
      vivos.delete(socket);
      socket.ping();
    }
  }, intervaloMs);
  return () => clearInterval(temporizador);
}
