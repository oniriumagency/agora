import type { CargaSenal, TipoPista } from "./protocolo";

/**
 * Conexión WebRTC única con el servidor (SFU).
 *
 * Al entrar, el navegador ofrece tres transceptores de envío (audio, cámara y pantalla). Después
 * solo ofrece el servidor, cuando añade ranuras para recibir a más gente. Encender o apagar la
 * cámara o la pantalla es un replaceTrack, sin renegociar. El mapa de PISTAS dice de quién es cada
 * ranura; con él se reconstruyen los flujos de cada participante.
 */
export const ORDEN_PISTAS: TipoPista[] = ["audio", "camara", "pantalla"];
const CLASE: Record<TipoPista, "audio" | "video"> = { audio: "audio", camara: "video", pantalla: "video" };

export type FlujosPorPersona = Record<string, Partial<Record<TipoPista, MediaStream>>>;

export interface EventosSfu {
  enviarSenal: (carga: CargaSenal) => void;
  alCambiarFlujos: (flujos: FlujosPorPersona) => void;
  alFallar: () => void;
}

export class ConexionSfu {
  private readonly conexion: RTCPeerConnection;
  private readonly envios = new Map<TipoPista, RTCRtpSender>();
  private mapa: Record<string, { id: string; tipo: TipoPista }> = {};
  private readonly flujosPorMid = new Map<string, MediaStream>();
  private candidatosPendientes: RTCIceCandidateInit[] = [];
  private cerrada = false;

  constructor(servidoresIce: RTCIceServer[], private readonly eventos: EventosSfu) {
    this.conexion = new RTCPeerConnection({ iceServers: servidoresIce, bundlePolicy: "max-bundle" });
    this.conexion.onicecandidate = ({ candidate }) => {
      if (candidate) this.eventos.enviarSenal(candidate.toJSON() as CargaSenal);
    };
    this.conexion.ontrack = () => this.recalcular();
    this.conexion.onconnectionstatechange = () => {
      if (this.conexion.connectionState === "failed" && !this.cerrada) this.eventos.alFallar();
    };
  }

  async iniciar(pistas: Readonly<Record<TipoPista, MediaStreamTrack | null>>): Promise<void> {
    for (const tipo of ORDEN_PISTAS) {
      const transceptor = this.conexion.addTransceiver(CLASE[tipo], { direction: "sendonly" });
      await transceptor.sender.replaceTrack(pistas[tipo]);
      this.envios.set(tipo, transceptor.sender);
    }
    const oferta = await this.conexion.createOffer();
    await this.conexion.setLocalDescription(oferta);
    this.eventos.enviarSenal({ tipo: "offer", sdp: oferta.sdp ?? "" });
  }

  async recibirSenal(carga: CargaSenal): Promise<void> {
    if (!("tipo" in carga)) {
      if (!this.conexion.remoteDescription) this.candidatosPendientes.push(carga);
      else await this.conexion.addIceCandidate(carga).catch(() => undefined);
      return;
    }
    await this.conexion.setRemoteDescription({ type: carga.tipo, sdp: carga.sdp });
    if (carga.tipo === "offer") {
      const respuesta = await this.conexion.createAnswer();
      await this.conexion.setLocalDescription(respuesta);
      this.eventos.enviarSenal({ tipo: "answer", sdp: respuesta.sdp ?? "" });
    }
    for (const candidato of this.candidatosPendientes.splice(0)) await this.conexion.addIceCandidate(candidato).catch(() => undefined);
    this.recalcular();
  }

  fijarMapa(mapa: Record<string, { id: string; tipo: TipoPista }>): void {
    this.mapa = mapa;
    this.recalcular();
  }

  async fijarPista(tipo: TipoPista, pista: MediaStreamTrack | null): Promise<void> {
    await this.envios.get(tipo)?.replaceTrack(pista).catch((error) => console.warn("[SFU] replaceTrack", error));
  }

  /** Ajusta la calidad de la cámara al tamaño de la reunión: menos bits cuanta más gente. */
  async ajustarCalidad(personas: number): Promise<void> {
    const emisor = this.envios.get("camara");
    if (!emisor) return;
    const parametros = emisor.getParameters();
    if (!parametros.encodings?.length) return;
    const [bits, escala] = personas <= 2 ? [1_500_000, 1] : personas <= 4 ? [900_000, 1] : personas <= 9 ? [500_000, 1.5] : [300_000, 2];
    parametros.encodings[0].maxBitrate = bits;
    parametros.encodings[0].scaleResolutionDownBy = escala;
    await emisor.setParameters(parametros).catch(() => undefined);
  }

  cerrar(): void {
    this.cerrada = true;
    this.conexion.close();
  }

  private recalcular(): void {
    const flujos: FlujosPorPersona = {};
    for (const transceptor of this.conexion.getTransceivers()) {
      const mid = transceptor.mid;
      const destino = mid ? this.mapa[mid] : undefined;
      if (!mid || !destino || !transceptor.receiver.track) continue;
      let flujo = this.flujosPorMid.get(mid);
      if (!flujo) {
        flujo = new MediaStream([transceptor.receiver.track]);
        this.flujosPorMid.set(mid, flujo);
      }
      (flujos[destino.id] ??= {})[destino.tipo] = flujo;
    }
    this.eventos.alCambiarFlujos(flujos);
  }
}
