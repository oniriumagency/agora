import { cifrarBytes, clavesActuales, deBase64Url } from "@/cifrado/claves";
import { descifrarOgg } from "@/cifrado/ogg";
import { obtenerArchivo } from "@/red/archivos";
import { urlServidor } from "@/red/urlSenalizacion";

/**
 * Búfer de reconexión, en los dos sentidos y siempre a 1,5×:
 * - ponerseAlDia: al volver, se pide al servidor por tramos el audio que se dijo mientras no
 *   estabas, se mezcla y se escucha acelerado (sin voz de ardilla) hasta alcanzar el directo.
 * - grabarSinConexion / enviarLoGrabado: si se corta la red, se graba tu micrófono; al volver se
 *   sube y los demás lo escuchan acelerado.
 * Todo va cifrado de extremo a extremo: el servidor guarda y reparte audio que no puede escuchar.
 */
const VELOCIDAD = 1.5;
const TASA = 48000;

type AudioConTono = HTMLAudioElement & { preservesPitch?: boolean; webkitPreservesPitch?: boolean; mozPreservesPitch?: boolean };

/** Reproduce una URL a 1,5× conservando el tono. Devuelve cuando termina (o se cancela). */
function reproducirAcelerado(url: string, senal: { cancelado: boolean }): Promise<void> {
  return new Promise((resolver) => {
    const audio = new Audio(url) as AudioConTono;
    audio.preservesPitch = audio.webkitPreservesPitch = audio.mozPreservesPitch = true;
    audio.playbackRate = VELOCIDAD;
    audio.defaultPlaybackRate = VELOCIDAD;
    const terminar = () => {
      clearInterval(vigilar);
      audio.pause();
      resolver();
    };
    const vigilar = setInterval(() => senal.cancelado && terminar(), 200);
    audio.onended = terminar;
    audio.onerror = terminar;
    audio.onloadedmetadata = () => (audio.playbackRate = VELOCIDAD);
    void audio.play().catch(terminar);
  });
}

/** Pista Ogg del servidor (base64 estándar) con cada paquete Opus descifrado. */
async function pistaDescifrada(base64: string): Promise<ArrayBuffer | null> {
  const claves = clavesActuales();
  return claves ? descifrarOgg(deBase64Url(base64), claves.medios) : null;
}

function aWav(buffer: AudioBuffer): Blob {
  const datos = buffer.getChannelData(0);
  const salida = new DataView(new ArrayBuffer(44 + datos.length * 2));
  const texto = (pos: number, s: string) => [...s].forEach((c, i) => salida.setUint8(pos + i, c.charCodeAt(0)));
  texto(0, "RIFF");
  salida.setUint32(4, 36 + datos.length * 2, true);
  texto(8, "WAVEfmt ");
  salida.setUint32(16, 16, true);
  salida.setUint16(20, 1, true);
  salida.setUint16(22, 1, true);
  salida.setUint32(24, buffer.sampleRate, true);
  salida.setUint32(28, buffer.sampleRate * 2, true);
  salida.setUint16(32, 2, true);
  salida.setUint16(34, 16, true);
  texto(36, "data");
  salida.setUint32(40, datos.length * 2, true);
  for (let i = 0; i < datos.length; i++) salida.setInt16(44 + i * 2, Math.max(-1, Math.min(1, datos[i])) * 0x7fff, true);
  return new Blob([salida], { type: "audio/wav" });
}

/** ¿Hay algo audible? (pico de energía en ventanas de 50 ms) */
function hayVoz(buffer: AudioBuffer): boolean {
  const datos = buffer.getChannelData(0);
  const ventana = Math.floor(buffer.sampleRate * 0.05);
  for (let inicio = 0; inicio < datos.length; inicio += ventana) {
    let suma = 0;
    const fin = Math.min(datos.length, inicio + ventana);
    for (let i = inicio; i < fin; i++) suma += datos[i] * datos[i];
    if (Math.sqrt(suma / (fin - inicio)) > 0.015) return true;
  }
  return false;
}

async function decodificar(datos: ArrayBuffer): Promise<AudioBuffer | null> {
  try {
    return await new OfflineAudioContext(1, TASA, TASA).decodeAudioData(datos);
  } catch {
    return null;
  }
}

async function mezclar(buffers: AudioBuffer[]): Promise<AudioBuffer> {
  const largo = Math.max(...buffers.map((b) => b.length));
  const ctx = new OfflineAudioContext(1, largo, buffers[0].sampleRate);
  const limitador = ctx.createDynamicsCompressor(); // varias voces a la vez no saturan
  limitador.connect(ctx.destination);
  for (const buffer of buffers) {
    const fuente = ctx.createBufferSource();
    fuente.buffer = buffer;
    fuente.connect(limitador);
    fuente.start(0);
  }
  return ctx.startRendering();
}

export interface Reposicion {
  cancelar: () => void;
  terminada: Promise<void>;
}

/** Escucha a 1,5× lo que se dijo desde `desde` (hora del servidor) hasta alcanzar el directo. */
export function ponerseAlDia(desde: number, clave: string, alAvanzar: (pendienteSeg: number) => void): Reposicion {
  const senal = { cancelado: false };
  const terminada = (async () => {
    let cursor = desde;
    for (let vuelta = 0; vuelta < 40 && !senal.cancelado; vuelta++) {
      const respuesta = await fetch(`${urlServidor()}/reposicion?desde=${cursor}`, { headers: { "X-Clave": clave }, cache: "no-store" });
      if (!respuesta.ok) break;
      const { hasta, pistas } = (await respuesta.json()) as { hasta: number; pistas: { ogg: string }[] | null };
      const tramo = hasta - cursor;
      cursor = hasta;
      alAvanzar(tramo / 1000);
      const oggs = await Promise.all((pistas ?? []).map((p) => pistaDescifrada(p.ogg)));
      const buffers = (await Promise.all(oggs.map((ogg) => (ogg ? decodificar(ogg) : null)))).filter((b): b is AudioBuffer => b !== null);
      if (buffers.length > 0) {
        const mezcla = await mezclar(buffers);
        if (hayVoz(mezcla)) {
          const url = URL.createObjectURL(aWav(mezcla));
          await reproducirAcelerado(url, senal);
          URL.revokeObjectURL(url);
        }
      }
      if (tramo < 1500) break; // ya casi en vivo
    }
    void fetch(`${urlServidor()}/reposicion?fin=1`, { headers: { "X-Clave": clave } }).catch(() => undefined);
  })().catch((error) => console.warn("[Reposición]", error));
  return { cancelar: () => (senal.cancelado = true), terminada };
}

// ---- Lo que dijiste sin conexión ----

let grabadora: MediaRecorder | null = null;
let trozos: Blob[] = [];

export function grabarSinConexion(pista: MediaStreamTrack | null): void {
  if (grabadora || !pista || pista.readyState !== "live" || !pista.enabled || typeof MediaRecorder === "undefined") return;
  try {
    trozos = [];
    grabadora = new MediaRecorder(new MediaStream([pista]));
    grabadora.ondataavailable = (evento) => evento.data.size > 0 && trozos.push(evento.data);
    grabadora.start(1000);
  } catch {
    grabadora = null;
  }
}

export function descartarGrabacion(): void {
  if (grabadora && grabadora.state !== "inactive") grabadora.stop();
  grabadora = null;
  trozos = [];
}

/** Al volver: si se dijo algo, se sube para que los demás lo escuchen. */
export async function enviarLoGrabado(clave: string): Promise<void> {
  const actual = grabadora;
  if (!actual) return;
  grabadora = null;
  if (actual.state !== "inactive") {
    await new Promise<void>((resolver) => {
      actual.onstop = () => resolver();
      actual.stop();
    });
  }
  const blob = new Blob(trozos, { type: actual.mimeType || "audio/webm" });
  trozos = [];
  if (blob.size < 2000) return;
  const decodificado = await decodificar(await blob.arrayBuffer());
  if (decodificado && !hayVoz(decodificado)) return; // solo silencio: no molestar a nadie
  const cifrado = new Blob([await cifrarBytes(await blob.arrayBuffer())], { type: "application/octet-stream" });
  await fetch(`${urlServidor()}/voz`, { method: "POST", headers: { "X-Clave": clave, "Content-Type": "application/octet-stream" }, body: cifrado }).catch(() => undefined);
}

/** Lo que otra persona dijo sin conexión: se escucha a 1,5×, en cola si llegan varias. */
let cola: Promise<void> = Promise.resolve();
export function escucharLoQueDijo(id: string, alEmpezar: () => void): void {
  cola = cola.then(async () => {
    const audio = await decodificar(await (await obtenerArchivo(id, "")).arrayBuffer());
    if (!audio) return;
    alEmpezar();
    const url = URL.createObjectURL(aWav(audio));
    await reproducirAcelerado(url, { cancelado: false });
    URL.revokeObjectURL(url);
  }).catch((error) => console.warn("[Reposición] Audio sin conexión", error));
}
