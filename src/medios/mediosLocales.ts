/**
 * Captura local: micrófono, cámara y pantalla. Cada una se abre por separado para poder apagar
 * la cámara (y su luz) sin tocar el micrófono, y para seguir en la reunión si se niega un permiso.
 */
export interface PreferenciasDispositivos {
  microfonoId?: string;
  camaraId?: string;
}

const AUDIO: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
const VIDEO: MediaTrackConstraints = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } };

export function describirErrorMedios(error: unknown, que: "micrófono" | "cámara" | "pantalla"): string | null {
  const nombre = error instanceof DOMException ? error.name : "";
  if (nombre === "NotAllowedError" || nombre === "SecurityError") {
    return que === "pantalla" ? null : `El navegador no tiene permiso para usar el ${que}. Actívalo en el candado de la barra de direcciones.`;
  }
  if (nombre === "NotFoundError" || nombre === "OverconstrainedError") return `No se encontró ningún ${que}.`;
  if (nombre === "NotReadableError") return `El ${que} está en uso por otra aplicación.`;
  if (!navigator.mediaDevices) return "Este navegador solo permite cámara y micrófono en páginas HTTPS.";
  return `No se pudo abrir el ${que}.`;
}

export async function abrirMicrofono(id?: string): Promise<MediaStreamTrack> {
  const flujo = await navigator.mediaDevices.getUserMedia({ audio: id ? { ...AUDIO, deviceId: { exact: id } } : AUDIO });
  return flujo.getAudioTracks()[0];
}

export async function abrirCamara(id?: string): Promise<MediaStreamTrack> {
  const flujo = await navigator.mediaDevices.getUserMedia({ video: id ? { ...VIDEO, deviceId: { exact: id } } : VIDEO });
  return flujo.getVideoTracks()[0];
}

export async function abrirPantalla(): Promise<MediaStreamTrack> {
  const flujo = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15, max: 30 } }, audio: false });
  const pista = flujo.getVideoTracks()[0];
  // Texto y diapositivas: priorizar nitidez sobre fluidez
  if ("contentHint" in pista) pista.contentHint = "detail";
  return pista;
}

export async function listarDispositivos(): Promise<{ microfonos: MediaDeviceInfo[]; camaras: MediaDeviceInfo[]; altavoces: MediaDeviceInfo[] }> {
  const todos = navigator.mediaDevices ? await navigator.mediaDevices.enumerateDevices() : [];
  const conId = todos.filter((dispositivo) => dispositivo.deviceId);
  return {
    microfonos: conId.filter((dispositivo) => dispositivo.kind === "audioinput"),
    camaras: conId.filter((dispositivo) => dispositivo.kind === "videoinput"),
    altavoces: conId.filter((dispositivo) => dispositivo.kind === "audiooutput"),
  };
}

export function flujoDe(pista: MediaStreamTrack | null): MediaStream | null {
  return pista ? new MediaStream([pista]) : null;
}

/** Los navegadores móviles no permiten capturar la pantalla aunque expongan getDisplayMedia. */
export function puedeCompartirPantalla(): boolean {
  if (typeof navigator === "undefined" || !navigator.mediaDevices || !("getDisplayMedia" in navigator.mediaDevices)) return false;
  return !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}
