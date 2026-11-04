import { abrirCamara, abrirMicrofono, abrirPantalla, describirErrorMedios, flujoDe } from "@/medios/mediosLocales";
import type { TipoPista } from "@/red/MallaWebRtc";
import type { Reaccion } from "@/red/protocolo";
import { enviarAlServidor, mallaActual } from "./sesion";
import { useReunion } from "./useReunion";

/**
 * Controles del propio participante: micrófono, cámara, pantalla, mano, chat y reacciones. Las
 * pistas viven aquí; la malla recibe cada cambio con replaceTrack y el servidor el nuevo estado.
 * Funcionan igual en la sala de espera (sin malla ni servidor) que dentro de la reunión.
 */
const pistas: Record<TipoPista, MediaStreamTrack | null> = { audio: null, camara: null, pantalla: null };
const dispositivos: { microfonoId?: string; camaraId?: string } = {};

const estado = () => useReunion.getState();

export function pistasLocales(): Readonly<Record<TipoPista, MediaStreamTrack | null>> {
  return pistas;
}

function fijarPista(tipo: TipoPista, pista: MediaStreamTrack | null): void {
  if (pistas[tipo] && pistas[tipo] !== pista) pistas[tipo]?.stop();
  pistas[tipo] = pista;
  void mallaActual()?.fijarPista(tipo, pista);
  if (tipo === "audio") estado().fijarLocal({ pistaMicro: pista, flujoMicro: flujoDe(pista) });
  if (tipo === "camara") estado().fijarLocal({ flujoCamara: flujoDe(pista) });
  if (tipo === "pantalla") estado().fijarLocal({ flujoPantalla: flujoDe(pista) });
}

function avisarError(error: unknown, que: "micrófono" | "cámara" | "pantalla"): void {
  const texto = describirErrorMedios(error, que);
  if (texto) estado().avisar(texto, "⚠️");
}

export async function fijarMicrofono(encendido: boolean): Promise<void> {
  if (encendido && !pistas.audio) {
    try {
      fijarPista("audio", await abrirMicrofono(dispositivos.microfonoId));
    } catch (error) {
      avisarError(error, "micrófono");
      estado().fijarLocal({ microfono: false });
      return;
    }
  }
  if (pistas.audio) pistas.audio.enabled = encendido;
  estado().fijarLocal({ microfono: encendido });
  enviarAlServidor({ tipo: "ESTADO", cambios: { microfono: encendido } });
}

export async function fijarCamara(encendida: boolean): Promise<void> {
  if (encendida) {
    try {
      fijarPista("camara", await abrirCamara(dispositivos.camaraId));
    } catch (error) {
      avisarError(error, "cámara");
      estado().fijarLocal({ camara: false });
      return;
    }
  } else fijarPista("camara", null);
  estado().fijarLocal({ camara: encendida });
  enviarAlServidor({ tipo: "ESTADO", cambios: { camara: encendida } });
}

export const alternarMicrofono = () => fijarMicrofono(!estado().local.microfono);
export const alternarCamara = () => fijarCamara(!estado().local.camara);

export async function alternarPantalla(): Promise<void> {
  if (estado().local.pantalla) return detenerPantalla();
  try {
    const pista = await abrirPantalla();
    pista.addEventListener("ended", () => void detenerPantalla());
    fijarPista("pantalla", pista);
    estado().fijarLocal({ pantalla: true });
    enviarAlServidor({ tipo: "ESTADO", cambios: { pantalla: true } });
  } catch (error) {
    avisarError(error, "pantalla");
  }
}

async function detenerPantalla(): Promise<void> {
  if (!pistas.pantalla) return;
  fijarPista("pantalla", null);
  estado().fijarLocal({ pantalla: false });
  enviarAlServidor({ tipo: "ESTADO", cambios: { pantalla: false } });
}

export function alternarMano(): void {
  const levantada = estado().local.mano !== null;
  // Respuesta inmediata en la interfaz; el servidor confirma con su propia hora
  estado().fijarLocal({ mano: levantada ? null : Date.now() });
  enviarAlServidor({ tipo: "ESTADO", cambios: { mano: !levantada } });
}

export function enviarChat(texto: string): void {
  const limpio = texto.trim();
  if (limpio) enviarAlServidor({ tipo: "CHAT", texto: limpio });
}

export function reaccionar(emoji: Reaccion): void {
  enviarAlServidor({ tipo: "REACCION", emoji });
}

/** Cambia de micrófono o cámara sin salir de la reunión (selector de dispositivos). */
export async function elegirDispositivo(tipo: "microfono" | "camara", id: string): Promise<void> {
  if (tipo === "microfono") {
    dispositivos.microfonoId = id;
    if (!pistas.audio) return;
    try {
      const pista = await abrirMicrofono(id);
      pista.enabled = estado().local.microfono;
      fijarPista("audio", pista);
    } catch (error) {
      avisarError(error, "micrófono");
    }
    return;
  }
  dispositivos.camaraId = id;
  if (estado().local.camara) await fijarCamara(true);
}

export function dispositivosElegidos(): Readonly<typeof dispositivos> {
  return dispositivos;
}

/** Abre micrófono y cámara para la vista previa de la sala de espera, según las preferencias. */
export async function prepararPrevia(microfono: boolean, camara: boolean): Promise<void> {
  await Promise.all([fijarMicrofono(microfono), camara ? fijarCamara(true) : Promise.resolve()]);
  if (!pistas.camara) estado().fijarLocal({ camara: false });
}

export function soltarMedios(): void {
  for (const tipo of ["audio", "camara", "pantalla"] as const) fijarPista(tipo, null);
}
