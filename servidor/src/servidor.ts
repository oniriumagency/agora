import { configuracion } from "./entorno.ts";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, type IncomingMessage } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { procesarTexto, enviar } from "./controlador.ts";
import { crearLimitador, evaluarAdmision, iniciarLatido, liberarConexion, registrarLatido } from "./politicas.ts";
import { RegistroSalas } from "./salas.ts";
import { obtenerServidoresIce, turnConfigurado } from "./turn.ts";

/**
 * Servidor de Kubox Meet: admite participantes en salas, retransmite la señalización WebRTC y
 * difunde estado, chat y reacciones. Un único proceso HTTP + WebSocket; GET /salud para monitores.
 */
const TAMANO_MAXIMO_MENSAJE = 64 * 1024;

export function crearServidor(puerto = configuracion.puerto) {
  const registro = new RegistroSalas();
  const ipPorSolicitud = new WeakMap<IncomingMessage, string | null>();
  const http = createServer((solicitud, respuesta) => {
    const salud = solicitud.url?.endsWith("/salud");
    respuesta.writeHead(salud ? 200 : 426, { "Content-Type": "text/plain; charset=utf-8" });
    respuesta.end(salud ? `ok ${registro.cantidad} salas` : "Servidor de señalización de Kubox Meet (WebSocket).");
  });
  const ws = new WebSocketServer({
    server: http,
    maxPayload: TAMANO_MAXIMO_MENSAJE,
    verifyClient: ({ req }, responder) => {
      const veredicto = evaluarAdmision(req);
      if (!veredicto.admitida) {
        console.warn(`[Política] Conexión rechazada: ${veredicto.motivo}`);
        return responder(false, 403, "Conexión no permitida");
      }
      ipPorSolicitud.set(req, veredicto.claveIp);
      responder(true);
    },
  });

  ws.on("connection", (socket: WebSocket, solicitud: IncomingMessage) => {
    const limitador = crearLimitador();
    registrarLatido(socket);
    socket.on("pong", () => registrarLatido(socket));
    void obtenerServidoresIce().then((servidores) => enviar(socket, { tipo: "SERVIDORES_ICE", servidores }));

    socket.on("message", (datos, binario) => {
      if (!limitador()) return socket.close(1008, "Demasiados mensajes");
      if (binario) return;
      procesarTexto(registro, socket, datos.toString());
    });
    socket.once("close", () => {
      liberarConexion(ipPorSolicitud.get(solicitud) ?? null);
      registro.retirar(socket);
    });
    socket.on("error", () => registro.retirar(socket));
  });

  const detenerLatido = iniciarLatido(ws);
  http.listen(puerto);
  const cerrar = () =>
    new Promise<void>((resolver) => {
      detenerLatido();
      ws.clients.forEach((socket) => socket.close(1001, "Servidor apagándose"));
      ws.close(() => http.close(() => resolver()));
    });
  return { http, ws, registro, cerrar };
}

const esPrincipal = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esPrincipal) {
  const { http, cerrar } = crearServidor();
  http.on("listening", () => {
    console.log(`[Kubox Meet] Señalización escuchando en el puerto ${configuracion.puerto}`);
    if (configuracion.origenesPermitidos.size === 0) console.warn("[Política] MEET_ORIGENES_PERMITIDOS vacío: se acepta cualquier origen.");
    if (turnConfigurado()) void obtenerServidoresIce();
    else console.warn("[TURN] Sin MEET_TURN_CLOUDFLARE_*: solo STUN (puede fallar tras CGNAT o datos móviles).");
  });
  http.on("error", (fallo) => {
    console.error(`[Kubox Meet] ${fallo.message}`);
    process.exit(1);
  });
  for (const senal of ["SIGINT", "SIGTERM"] as const) process.on(senal, () => void cerrar().then(() => process.exit(0)));
}
