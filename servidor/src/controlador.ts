import { randomUUID } from "node:crypto";
import type { WebSocket } from "ws";
import { configuracion } from "./entorno.ts";
import type { CodigoError, MensajeCliente, MensajeServidor } from "./protocolo.ts";
import type { RegistroSalas } from "./salas.ts";
import { validarMensaje } from "./validacion.ts";

/**
 * Despacha cada mensaje de un cliente. La identidad del emisor es siempre la de su socket, nunca
 * un campo del mensaje: el servidor asigna los identificadores y añade el origen de cada señal.
 */
export function enviar(socket: WebSocket, mensaje: MensajeServidor): void {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(mensaje));
}

function error(socket: WebSocket, codigo: CodigoError, mensaje: string): void {
  enviar(socket, { tipo: "ERROR", codigo, mensaje });
}

export function procesarTexto(registro: RegistroSalas, socket: WebSocket, texto: string): void {
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    error(socket, "MENSAJE_INVALIDO", "El mensaje no es JSON válido.");
    return;
  }
  const mensaje = validarMensaje(datos);
  if (!mensaje) {
    error(socket, "MENSAJE_INVALIDO", "Mensaje con formato o valores no admitidos.");
    return;
  }
  procesarMensaje(registro, socket, mensaje);
}

function unirse(registro: RegistroSalas, socket: WebSocket, mensaje: Extract<MensajeCliente, { tipo: "UNIRSE" }>): void {
  if (registro.contexto(socket)) return error(socket, "YA_EN_SALA", "Esta conexión ya está en una reunión.");
  if (!registro.existe(mensaje.sala) && registro.cantidad >= configuracion.maximoSalas) {
    return error(socket, "LIMITE_SALAS", "El servidor alcanzó el máximo de reuniones simultáneas.");
  }
  const sala = registro.obtenerOCrear(mensaje.sala);
  if (sala.miembros.size >= configuracion.maximoPorSala) {
    return error(socket, "SALA_LLENA", `La reunión está completa (máximo ${configuracion.maximoPorSala} personas).`);
  }
  const participante = {
    id: randomUUID(),
    nombre: mensaje.nombre,
    estado: { ...mensaje.estado, pantalla: false, mano: null },
    entradaEn: Date.now(),
  };
  const presentes = sala.participantes();
  registro.registrar(socket, sala, participante);
  enviar(socket, { tipo: "BIENVENIDA", miId: participante.id, sala: sala.codigo, participantes: presentes, chat: sala.chat });
  sala.difundir({ tipo: "ENTRO", participante }, participante.id);
}

export function procesarMensaje(registro: RegistroSalas, socket: WebSocket, mensaje: MensajeCliente): void {
  if (mensaje.tipo === "UNIRSE") return unirse(registro, socket, mensaje);

  const contexto = registro.contexto(socket);
  if (!contexto) return error(socket, "NO_EN_SALA", "Primero hay que unirse a una reunión.");
  const { sala, yo } = contexto;

  switch (mensaje.tipo) {
    case "SENAL": {
      const destino = sala.miembros.get(mensaje.destino);
      if (!destino || destino.participante.id === yo.id) {
        return error(socket, "DESTINO_DESCONOCIDO", "El destinatario no está en la reunión.");
      }
      enviar(destino.socket, { tipo: "SENAL", origen: yo.id, carga: mensaje.carga });
      return;
    }
    case "ESTADO": {
      const actualizado = sala.aplicarEstado(yo.id, mensaje.cambios);
      if (actualizado) sala.difundir({ tipo: "ESTADO", id: yo.id, estado: actualizado.estado });
      return;
    }
    case "CHAT":
      sala.difundir({ tipo: "CHAT", mensaje: sala.agregarChat(yo, mensaje.texto) });
      return;
    case "REACCION":
      sala.difundir({ tipo: "REACCION", id: yo.id, emoji: mensaje.emoji });
      return;
  }
}
