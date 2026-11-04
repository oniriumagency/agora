import type { MensajeChat, Participante, Reaccion } from "@/red/protocolo";
import type { TipoPista } from "@/red/MallaWebRtc";

export type Fase = "previa" | "conectando" | "reunion" | "reconectando" | "fuera" | "error";
export type Panel = "chat" | "personas" | "info" | null;

export interface ParticipanteRemoto extends Participante {
  flujos: Partial<Record<TipoPista, MediaStream>>;
  conexion: RTCPeerConnectionState;
}

export interface EstadoLocal {
  microfono: boolean;
  camara: boolean;
  pantalla: boolean;
  mano: number | null;
  pistaMicro: MediaStreamTrack | null;
  flujoMicro: MediaStream | null;
  flujoCamara: MediaStream | null;
  flujoPantalla: MediaStream | null;
}

export interface Aviso {
  id: number;
  texto: string;
  icono?: string;
}

export interface ReaccionVisible {
  id: number;
  emoji: Reaccion;
  nombre: string;
  izquierda: number;
}

/** Identificador de lo que se destaca en grande: una persona (cámara) o su pantalla. */
export type Destacado = { id: string; pantalla: boolean } | null;

export type { MensajeChat };
