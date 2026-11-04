/**
 * Protocolo del servidor de Kubox Meet, compartido con el cliente (solo tipos y constantes).
 *
 * El servidor admite a cada participante en una sala, retransmite la señalización WebRTC entre
 * pares (malla: cada participante negocia con todos los demás) y difunde lo que debe ver toda la
 * sala: quién está, el estado de su micrófono/cámara/pantalla, la mano alzada, el chat y las
 * reacciones. El audio y el vídeo nunca pasan por el servidor: viajan P2P (o por TURN).
 */

/** Código de sala, p. ej. "abc-defg-hij". Lo genera el cliente; la sala nace con su primer participante. */
export const PATRON_SALA = /^[a-z0-9]{3,12}(-[a-z0-9]{3,12}){0,3}$/;
export const LARGO_MAXIMO_NOMBRE = 40;
export const LARGO_MAXIMO_CHAT = 1000;
export const REACCIONES = ["👍", "❤️", "😂", "😮", "👏", "🎉"] as const;
export type Reaccion = (typeof REACCIONES)[number];

/** Estado visible de un participante. `mano` es la hora (del servidor) en que la alzó, o null. */
export interface EstadoParticipante {
  microfono: boolean;
  camara: boolean;
  pantalla: boolean;
  mano: number | null;
}

export interface Participante {
  id: string;
  nombre: string;
  estado: EstadoParticipante;
  entradaEn: number;
}

export interface MensajeChat {
  id: string;
  autorId: string;
  autorNombre: string;
  texto: string;
  enviadoEn: number;
}

export interface DescripcionSdp {
  tipo: "offer" | "answer";
  sdp: string;
}

export interface CandidatoIce {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
  usernameFragment?: string | null;
}

export type CargaSenal = DescripcionSdp | CandidatoIce;

/** Forma serializable de RTCIceServer. */
export interface ServidorIce {
  urls: string[];
  username?: string;
  credential?: string;
}

/** Cambios de estado que un participante pide para sí mismo (mano: true = alzar, false = bajar). */
export interface CambiosEstado {
  microfono?: boolean;
  camara?: boolean;
  pantalla?: boolean;
  mano?: boolean;
}

export type MensajeCliente =
  | { tipo: "UNIRSE"; sala: string; nombre: string; estado: { microfono: boolean; camara: boolean } }
  | { tipo: "SENAL"; destino: string; carga: CargaSenal }
  | { tipo: "ESTADO"; cambios: CambiosEstado }
  | { tipo: "CHAT"; texto: string }
  | { tipo: "REACCION"; emoji: Reaccion };

export type MensajeServidor =
  | { tipo: "SERVIDORES_ICE"; servidores: ServidorIce[] }
  | { tipo: "BIENVENIDA"; miId: string; sala: string; participantes: Participante[]; chat: MensajeChat[] }
  | { tipo: "ENTRO"; participante: Participante }
  | { tipo: "SALIO"; id: string }
  | { tipo: "ESTADO"; id: string; estado: EstadoParticipante }
  | { tipo: "CHAT"; mensaje: MensajeChat }
  | { tipo: "REACCION"; id: string; emoji: Reaccion }
  | { tipo: "SENAL"; origen: string; carga: CargaSenal }
  | { tipo: "ERROR"; codigo: CodigoError; mensaje: string };

export type CodigoError = "SALA_LLENA" | "MENSAJE_INVALIDO" | "NO_EN_SALA" | "YA_EN_SALA" | "DESTINO_DESCONOCIDO" | "LIMITE_SALAS";
