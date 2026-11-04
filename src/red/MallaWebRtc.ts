import type { CargaSenal } from "./protocolo";

/**
 * Malla WebRTC: una RTCPeerConnection con cada participante.
 *
 * Cada conexión lleva siempre tres transceptores en el mismo orden (audio, cámara, pantalla). Quien
 * llega a la reunión ofrece a los que ya estaban; ellos solo responden, así nunca hay ofertas
 * cruzadas. Encender o apagar la cámara o la pantalla es un replaceTrack en el transceptor fijo,
 * sin renegociar. Si ICE falla, quien ofreció reinicia ICE con una oferta nueva.
 */
export type TipoPista = "audio" | "camara" | "pantalla";
export const ORDEN_PISTAS: TipoPista[] = ["audio", "camara", "pantalla"];
const CLASE: Record<TipoPista, "audio" | "video"> = { audio: "audio", camara: "video", pantalla: "video" };

export interface EventosMalla {
  enviarSenal: (destino: string, carga: CargaSenal) => void;
  alRecibirPista: (id: string, tipo: TipoPista, flujo: MediaStream) => void;
  alCambiarConexion: (id: string, estado: RTCPeerConnectionState) => void;
}

interface Par {
  conexion: RTCPeerConnection;
  iniciador: boolean;
  preparado: boolean;
  candidatosPendientes: RTCIceCandidateInit[];
}

export class MallaWebRtc {
  private readonly pares = new Map<string, Par>();
  private readonly pistas: Record<TipoPista, MediaStreamTrack | null> = { audio: null, camara: null, pantalla: null };

  constructor(private readonly servidoresIce: RTCIceServer[], private readonly eventos: EventosMalla) {}

  /** Quien llega a la reunión llama a esto por cada participante que ya estaba. */
  async ofrecerA(id: string): Promise<void> {
    const par = this.crearPar(id, true);
    for (const tipo of ORDEN_PISTAS) {
      const transceptor = par.conexion.addTransceiver(CLASE[tipo], { direction: "sendrecv" });
      await transceptor.sender.replaceTrack(this.pistas[tipo]);
    }
    par.preparado = true;
    await this.enviarOferta(id, par);
  }

  async recibirSenal(origen: string, carga: CargaSenal): Promise<void> {
    const par = this.pares.get(origen) ?? this.crearPar(origen, false);
    const { conexion } = par;
    if (!("tipo" in carga)) {
      if (!conexion.remoteDescription) par.candidatosPendientes.push(carga);
      else await conexion.addIceCandidate(carga).catch((error) => console.warn("[Malla] Candidato ICE descartado", error));
      return;
    }
    await conexion.setRemoteDescription({ type: carga.tipo, sdp: carga.sdp });
    if (carga.tipo === "offer") {
      if (!par.preparado) {
        // Los transceptores los creó la oferta, en el orden acordado: se activan para enviar
        const transceptores = conexion.getTransceivers();
        for (const [indice, tipo] of ORDEN_PISTAS.entries()) {
          const transceptor = transceptores[indice];
          if (!transceptor) continue;
          transceptor.direction = "sendrecv";
          await transceptor.sender.replaceTrack(this.pistas[tipo]);
        }
        par.preparado = true;
      }
      const respuesta = await conexion.createAnswer();
      await conexion.setLocalDescription(respuesta);
      this.eventos.enviarSenal(origen, { tipo: "answer", sdp: respuesta.sdp ?? "" });
    }
    for (const candidato of par.candidatosPendientes.splice(0)) await conexion.addIceCandidate(candidato).catch(() => undefined);
  }

  /** Cambia la pista local de un tipo en todas las conexiones (null = dejar de enviar). */
  async fijarPista(tipo: TipoPista, pista: MediaStreamTrack | null): Promise<void> {
    this.pistas[tipo] = pista;
    const indice = ORDEN_PISTAS.indexOf(tipo);
    await Promise.all(
      [...this.pares.values()]
        .filter((par) => par.preparado)
        .map((par) => par.conexion.getTransceivers()[indice]?.sender.replaceTrack(pista).catch((error) => console.warn("[Malla] replaceTrack", error)))
    );
  }

  cerrarPar(id: string): void {
    this.pares.get(id)?.conexion.close();
    this.pares.delete(id);
  }

  cerrarTodo(): void {
    for (const id of [...this.pares.keys()]) this.cerrarPar(id);
  }

  /** Estadística mínima para diagnóstico: ¿la conexión con este par va por TURN? */
  conexionDe(id: string): RTCPeerConnection | undefined {
    return this.pares.get(id)?.conexion;
  }

  private crearPar(id: string, iniciador: boolean): Par {
    this.cerrarPar(id);
    const conexion = new RTCPeerConnection({ iceServers: this.servidoresIce });
    const par: Par = { conexion, iniciador, preparado: false, candidatosPendientes: [] };
    this.pares.set(id, par);
    conexion.onicecandidate = ({ candidate }) => {
      if (candidate) this.eventos.enviarSenal(id, candidate.toJSON() as CargaSenal);
    };
    conexion.ontrack = ({ transceiver, track }) => {
      const tipo = ORDEN_PISTAS[conexion.getTransceivers().indexOf(transceiver)];
      if (tipo) this.eventos.alRecibirPista(id, tipo, new MediaStream([track]));
    };
    conexion.onconnectionstatechange = () => {
      if (this.pares.get(id) !== par) return;
      this.eventos.alCambiarConexion(id, conexion.connectionState);
      if (conexion.connectionState === "failed" && par.iniciador) {
        conexion.restartIce();
        void this.enviarOferta(id, par);
      }
    };
    return par;
  }

  private async enviarOferta(id: string, par: Par): Promise<void> {
    const oferta = await par.conexion.createOffer();
    await par.conexion.setLocalDescription(oferta);
    this.eventos.enviarSenal(id, { tipo: "offer", sdp: oferta.sdp ?? "" });
  }
}
