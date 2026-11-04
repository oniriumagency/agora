/**
 * Mantiene la pantalla encendida durante la reunión (Screen Wake Lock). El navegador lo suelta al
 * ocultar la página, así que se pide de nuevo al volver. Quien decide si hace falta es el modo
 * bolsillo: en una llamada solo de audio en Android se suelta, para que el teléfono se apague y
 * bloquee con su propio tiempo de espera mientras el audio sigue.
 */
let bloqueo: WakeLockSentinel | null = null;
let deseado = true;

export async function mantenerPantallaEncendida(): Promise<void> {
  if (!deseado || (bloqueo && !bloqueo.released)) return;
  if (typeof navigator === "undefined" || !("wakeLock" in navigator) || document.hidden) return;
  try {
    bloqueo = await navigator.wakeLock.request("screen");
  } catch {
    bloqueo = null; // sin permiso o batería baja: no pasa nada
  }
}

export async function soltarPantallaEncendida(): Promise<void> {
  const actual = bloqueo;
  bloqueo = null;
  await actual?.release().catch(() => undefined);
}

/** Pide o suelta el bloqueo según convenga ahora. */
export function quererPantallaEncendida(quiere: boolean): void {
  deseado = quiere;
  void (quiere ? mantenerPantallaEncendida() : soltarPantallaEncendida());
}
