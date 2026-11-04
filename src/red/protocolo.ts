/**
 * Protocolo entre la web y el servidor de Ágora (espejo de servidor-go/protocolo.go).
 *
 * El servidor es un SFU: cada participante mantiene una sola conexión WebRTC con él, le envía su
 * micrófono, cámara y pantalla, y recibe de él el audio y el vídeo de los demás por "ranuras". El
 * mensaje PISTAS dice qué persona y qué tipo lleva cada ranura (identificada por su mid).
 */
export const PATRON_SALA = /^[a-z0-9]{3,12}(-[a-z0-9]{3,12}){0,3}$/;
export const LARGO_MAXIMO_NOMBRE = 40;
export const LARGO_MAXIMO_CHAT = 1000;
export const REACCIONES = ["👍", "❤️", "😂", "😮", "👏", "🎉"] as const;
export type Reaccion = (typeof REACCIONES)[number];
export type TipoPista = "audio" | "camara" | "pantalla";

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
  archivo?: ArchivoChat;
}

/** Archivo compartido en el chat; se descarga del servidor de la reunión mientras exista la sala. */
export interface ArchivoChat {
  id: string;
  nombre: string;
  tamano: number;
  tipo: string;
  vistaPrevia: boolean;
}

export interface DescripcionSdp {
  tipo: "offer" | "answer";
  sdp: string;
}

export interface CandidatoIce {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

export type CargaSenal = DescripcionSdp | CandidatoIce;

export interface ServidorIce {
  urls: string[];
  username?: string;
  credential?: string;
}

export interface CambiosEstado {
  microfono?: boolean;
  camara?: boolean;
  pantalla?: boolean;
  mano?: boolean;
}

export type MensajeCliente =
  | { tipo: "UNIRSE"; sala: string; nombre: string; estado: { microfono: boolean; camara: boolean } }
  | { tipo: "SENAL"; carga: CargaSenal }
  | { tipo: "ESTADO"; cambios: CambiosEstado }
  | { tipo: "CHAT"; texto: string }
  | { tipo: "REACCION"; emoji: Reaccion }
  | { tipo: "SUSCRIBIR"; videos: string[] };

export type MensajeServidor =
  | { tipo: "SERVIDORES_ICE"; servidores: ServidorIce[] }
  | { tipo: "BIENVENIDA"; miId: string; sala: string; participantes: Participante[]; chat: MensajeChat[]; maximoVideos: number; clave: string; maximoArchivoMB: number }
  | { tipo: "ENTRO"; participante: Participante }
  | { tipo: "SALIO"; id: string }
  | { tipo: "ESTADO"; id: string; estado: EstadoParticipante }
  | { tipo: "CHAT"; mensaje: MensajeChat }
  | { tipo: "REACCION"; id: string; emoji: Reaccion }
  | { tipo: "SENAL"; carga: CargaSenal }
  | { tipo: "PISTAS"; mapa: Record<string, { id: string; tipo: TipoPista }> }
  | { tipo: "ERROR"; codigo: string; mensaje: string };
