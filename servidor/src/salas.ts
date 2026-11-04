import { randomUUID } from "node:crypto";
import type { WebSocket } from "ws";
import type { CambiosEstado, MensajeChat, MensajeServidor, Participante } from "./protocolo.ts";

/**
 * Salas en memoria. Una sala nace con su primer participante y desaparece con el último; no hay
 * anfitrión: todos los participantes son iguales. El chat guarda los últimos mensajes para quien
 * llega tarde a la reunión.
 */
const HISTORIAL_MAXIMO_CHAT = 200;

export interface Miembro {
  socket: WebSocket;
  participante: Participante;
}

export class Sala {
  readonly codigo: string;
  readonly miembros = new Map<string, Miembro>();
  readonly chat: MensajeChat[] = [];

  constructor(codigo: string) {
    this.codigo = codigo;
  }

  participantes(): Participante[] {
    return [...this.miembros.values()].map((miembro) => miembro.participante);
  }

  /** Envía a todos los miembros salvo, opcionalmente, a uno. */
  difundir(mensaje: MensajeServidor, excepto?: string): void {
    const texto = JSON.stringify(mensaje);
    for (const [id, miembro] of this.miembros) {
      if (id !== excepto && miembro.socket.readyState === miembro.socket.OPEN) miembro.socket.send(texto);
    }
  }

  /** Aplica los cambios pedidos por un participante. La hora de la mano la fija el servidor. */
  aplicarEstado(id: string, cambios: CambiosEstado): Participante | null {
    const miembro = this.miembros.get(id);
    if (!miembro) return null;
    const estado = miembro.participante.estado;
    if (cambios.microfono !== undefined) estado.microfono = cambios.microfono;
    if (cambios.camara !== undefined) estado.camara = cambios.camara;
    if (cambios.pantalla !== undefined) estado.pantalla = cambios.pantalla;
    if (cambios.mano === true && estado.mano === null) estado.mano = Date.now();
    if (cambios.mano === false) estado.mano = null;
    return miembro.participante;
  }

  agregarChat(autor: Participante, texto: string): MensajeChat {
    const mensaje: MensajeChat = { id: randomUUID(), autorId: autor.id, autorNombre: autor.nombre, texto, enviadoEn: Date.now() };
    this.chat.push(mensaje);
    if (this.chat.length > HISTORIAL_MAXIMO_CHAT) this.chat.shift();
    return mensaje;
  }
}

export class RegistroSalas {
  private readonly salas = new Map<string, Sala>();
  private readonly porSocket = new WeakMap<WebSocket, { sala: Sala; id: string }>();

  get cantidad(): number {
    return this.salas.size;
  }

  obtenerOCrear(codigo: string): Sala {
    let sala = this.salas.get(codigo);
    if (!sala) {
      sala = new Sala(codigo);
      this.salas.set(codigo, sala);
    }
    return sala;
  }

  existe(codigo: string): boolean {
    return this.salas.has(codigo);
  }

  registrar(socket: WebSocket, sala: Sala, participante: Participante): void {
    sala.miembros.set(participante.id, { socket, participante });
    this.porSocket.set(socket, { sala, id: participante.id });
  }

  contexto(socket: WebSocket): { sala: Sala; yo: Participante } | null {
    const registro = this.porSocket.get(socket);
    const yo = registro?.sala.miembros.get(registro.id)?.participante;
    return registro && yo ? { sala: registro.sala, yo } : null;
  }

  /** Saca al socket de su sala, avisa al resto y borra la sala si queda vacía. */
  retirar(socket: WebSocket): void {
    const registro = this.porSocket.get(socket);
    if (!registro) return;
    this.porSocket.delete(socket);
    const { sala, id } = registro;
    if (!sala.miembros.delete(id)) return;
    sala.difundir({ tipo: "SALIO", id });
    if (sala.miembros.size === 0) this.salas.delete(sala.codigo);
  }
}
