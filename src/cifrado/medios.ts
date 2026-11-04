import { clavesActuales } from "./claves";

/**
 * Engancha el cifrado de extremo a extremo a los emisores y receptores de la conexión WebRTC.
 * Prefiere RTCRtpScriptTransform y, si el navegador no lo tiene, createEncodedStreams (Chrome).
 */
type Clase = "audio" | "video";
type ConFlujos = { createEncodedStreams: () => { readable: ReadableStream; writable: WritableStream } };
type ConTransformacion = { transform: unknown };
type ScriptTransform = new (trabajador: Worker, opciones: unknown) => unknown;

const TransformacionScript = (): ScriptTransform | undefined =>
  typeof window !== "undefined" ? (window as unknown as { RTCRtpScriptTransform?: ScriptTransform }).RTCRtpScriptTransform : undefined;

/** ¿Hay que crear la conexión con encodedInsertableStreams (API antigua de Chrome)? */
export function usaFlujosCodificados(): boolean {
  return !TransformacionScript() && typeof RTCRtpSender !== "undefined" && "createEncodedStreams" in RTCRtpSender.prototype;
}

export function cifradoMediosDisponible(): boolean {
  return !!TransformacionScript() || usaFlujosCodificados();
}

let trabajador: Worker | null = null;
const protegidos = new WeakSet<RTCRtpSender | RTCRtpReceiver>();

function obtenerTrabajador(): Worker {
  if (!trabajador) {
    trabajador = new Worker(new URL("./trabajadorMedios.ts", import.meta.url));
    const claves = clavesActuales();
    if (claves) trabajador.postMessage({ tipo: "clave", bytes: claves.mediosCrudos.slice(0) });
  }
  return trabajador;
}

function proteger(extremo: RTCRtpSender | RTCRtpReceiver, lado: "enviar" | "recibir", clase: Clase): void {
  if (protegidos.has(extremo)) return;
  protegidos.add(extremo);
  const opciones = { lado, clase };
  const Script = TransformacionScript();
  if (Script) {
    (extremo as unknown as ConTransformacion).transform = new Script(obtenerTrabajador(), opciones);
    return;
  }
  const { readable, writable } = (extremo as unknown as ConFlujos).createEncodedStreams();
  obtenerTrabajador().postMessage({ tipo: "flujos", readable, writable, ...opciones }, [readable as unknown as Transferable, writable as unknown as Transferable]);
}

export const protegerEmisor = (emisor: RTCRtpSender, clase: Clase): void => proteger(emisor, "enviar", clase);

export function protegerReceptor(receptor: RTCRtpReceiver): void {
  proteger(receptor, "recibir", receptor.track.kind === "audio" ? "audio" : "video");
}

export function detenerCifradoMedios(): void {
  trabajador?.terminate();
  trabajador = null;
}
