/**
 * Mantiene la pantalla del celular encendida durante la reunión (Screen Wake Lock), para que no se
 * bloquee sola y corte la llamada. El navegador la suelta al ocultar la página: se pide de nuevo al volver.
 */
let bloqueo: WakeLockSentinel | null = null;

export async function mantenerPantallaEncendida(): Promise<void> {
  if (bloqueo && !bloqueo.released) return;
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
