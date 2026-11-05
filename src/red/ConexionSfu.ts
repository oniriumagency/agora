import type { CargaSenal, TipoPista } from "./protocolo";
import { protegerEmisor, protegerReceptor, usaFlujosCodificados } from "@/cifrado/medios";

/**
 * Conexión WebRTC única con el servidor (SFU).
 *
 * Al entrar, el navegador ofrece tres transceptores de envío (audio, cámara y pantalla). Después
 * solo ofrece el servidor, cuando añade ranuras para recibir a más gente. Encender o apagar la
 * cámara o la pantalla es un replaceTrack, sin renegociar. El mapa de PISTAS dice de quién es cada
 * ranura; con él se reconstruyen los flujos de cada participante.
 *
 * Todo emisor y receptor pasa por el cifrado de extremo a extremo (ver cifrado/medios.ts): el
 * servidor reenvía fotogramas que no puede descifrar.
 */
/** Si en este tiempo no se llega a conectar, la red no lo permite (Chrome tarda en declarar "failed"). */
const ESPERA_MAXIMA_CONEXION_MS = 25_000;

export const ORDEN_PISTAS: TipoPista[] = ["audio", "camara", "pantalla"];
const CLASE: Record<TipoPista, "audio" | "video"> = { audio: "audio", camara: "video", pantalla: "video" };

/**
 * Simulcast de la cámara: tres calidades de la misma imagen. El servidor reenvía a cada persona la
 * que cabe en su conexión y avisa (CAPAS) de cuál es la más alta que alguien ve, para no gastar
 * subida en las demás. El orden (de menos a más) es el que espera el servidor.
 */
const CAPAS_CAMARA: RTCRtpEncodingParameters[] = [
  { rid: "q", scaleResolutionDownBy: 4, maxBitrate: 150_000 },
  { rid: "h", scaleResolutionDownBy: 2, maxBitrate: 500_000 },
  { rid: "f", scaleResolutionDownBy: 1, maxBitrate: 1_500_000 },
];

export type FlujosPorPersona = Record<string, Partial<Record<TipoPista, MediaStream>>>;

export interface EventosSfu {
  enviarSenal: (carga: CargaSenal) => void;
  alCambiarFlujos: (flujos: FlujosPorPersona) => void;
  /** `nuncaConecto`: la red no permitió llegar al servidor (no es un corte momentáneo). */
  alFallar: (nuncaConecto: boolean) => void;
}

export class ConexionSfu {
  private readonly conexion: RTCPeerConnection;
  private readonly envios = new Map<TipoPista, RTCRtpSender>();
  private mapa: Record<string, { id: string; tipo: TipoPista }> = {};
  private readonly flujosPorMid = new Map<string, MediaStream>();
  private candidatosPendientes: RTCIceCandidateInit[] = [];
  private cerrada = false;
  private conecto = false;
  private avisada = false;
  private capaMaxima = CAPAS_CAMARA.length - 1;

  constructor(servidoresIce: RTCIceServer[], private readonly eventos: EventosSfu) {
    const configuracion = { iceServers: servidoresIce, bundlePolicy: "max-bundle", encodedInsertableStreams: usaFlujosCodificados() } as RTCConfiguration;
    this.conexion = new RTCPeerConnection(configuracion);
    this.conexion.onicecandidate = ({ candidate }) => {
      if (candidate) this.eventos.enviarSenal(candidate.toJSON() as CargaSenal);
    };
    this.conexion.ontrack = ({ receiver }) => {
      protegerReceptor(receiver);
      this.recalcular();
    };
    this.conexion.onconnectionstatechange = () => {
      const estado = this.conexion.connectionState;
      if (estado === "connected") this.conecto = true;
      if (estado !== "failed" || this.cerrada) return;
      if (this.conecto) this.eventos.alFallar(false);
      else this.fallar();
    };
  }

  async iniciar(pistas: Readonly<Record<TipoPista, MediaStreamTrack | null>>): Promise<void> {
    for (const tipo of ORDEN_PISTAS) {
      const transceptor = this.conexion.addTransceiver(CLASE[tipo], tipo === "camara" ? { direction: "sendonly", sendEncodings: CAPAS_CAMARA } : { direction: "sendonly" });
      protegerEmisor(transceptor.sender, CLASE[tipo]);
      await transceptor.sender.replaceTrack(pistas[tipo]);
      this.envios.set(tipo, transceptor.sender);
    }
    const oferta = await this.conexion.createOffer();
    await this.conexion.setLocalDescription(oferta);
    this.eventos.enviarSenal({ tipo: "offer", sdp: oferta.sdp ?? "" });
    setTimeout(() => this.fallar(), ESPERA_MAXIMA_CONEXION_MS);
  }

  private fallar(): void {
    if (this.cerrada || this.conecto || this.avisada) return;
    this.avisada = true;
    this.eventos.alFallar(true);
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
    void this.aplicarCapas();
  }

  fijarMapa(mapa: Record<string, { id: string; tipo: TipoPista }>): void {
    this.mapa = mapa;
    this.recalcular();
  }

  async fijarPista(tipo: TipoPista, pista: MediaStreamTrack | null): Promise<void> {
    await this.envios.get(tipo)?.replaceTrack(pista).catch((error) => console.warn("[SFU] replaceTrack", error));
  }

  /** Activa las capas de la cámara hasta `maxima` (0 baja, 1 media, 2 alta); las demás no se envían. */
  fijarCapaMaxima(maxima: number): void {
    this.capaMaxima = maxima;
    void this.aplicarCapas();
  }

  /** setParameters falla mientras hay una negociación en curso: entonces se reintenta. */
  private async aplicarCapas(): Promise<void> {
    const emisor = this.envios.get("camara");
    const parametros = emisor?.getParameters();
    if (!emisor || !parametros?.encodings?.length || this.cerrada) return;
    if (parametros.encodings.every((capa, i) => capa.active === i <= this.capaMaxima)) return;
    parametros.encodings.forEach((capa, i) => (capa.active = i <= this.capaMaxima));
    await emisor.setParameters(parametros).catch(() => setTimeout(() => void this.aplicarCapas(), 1000));
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
