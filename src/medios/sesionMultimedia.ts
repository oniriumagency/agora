/**
 * Segundo plano en el celular. En Android, Chrome mantiene viva una llamada WebRTC con la pantalla
 * bloqueada si la página está reproduciendo y capturando audio; aquí se le dice al sistema que es
 * una llamada (Media Session: título, icono y botones de micrófono, cámara y colgar en la pantalla
 * de bloqueo) y se pausa la cámara mientras no se ve la página, para que el sistema no corte la
 * captura y ahorrar batería y datos. Al volver, la cámara se reanuda sola.
 */
type Acciones = { alternarMicrofono: () => void; alternarCamara: () => void; colgar: () => void };

let sala = "";

export function anunciarLlamada(codigoSala: string, acciones: Acciones): void {
  sala = codigoSala;
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  const sesion = navigator.mediaSession;
  try {
    sesion.metadata = new MediaMetadata({
      title: "Reunión en Ágora",
      artist: sala,
      artwork: [
        { src: "/icono-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icono-512.png", sizes: "512x512", type: "image/png" },
      ],
    });
    sesion.playbackState = "playing";
  } catch {
    /* navegador sin MediaMetadata */
  }
  // Acciones de videollamada (Chrome): aparecen en la pantalla de bloqueo y en la notificación
  const manejar = (accion: string, fn: () => void) => {
    try {
      sesion.setActionHandler(accion as MediaSessionAction, fn);
    } catch {
      /* acción no admitida en este navegador */
    }
  };
  manejar("togglemicrophone", acciones.alternarMicrofono);
  manejar("togglecamera", acciones.alternarCamara);
  manejar("hangup", acciones.colgar);
  // Que el sistema no la trate como música que se puede pausar
  manejar("pause", () => undefined);
}

type SesionLlamada = MediaSession & { setMicrophoneActive?: (activo: boolean) => void; setCameraActive?: (activa: boolean) => void };

export function reflejarEstadoLlamada(microfono: boolean, camara: boolean): void {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  const sesion = navigator.mediaSession as SesionLlamada;
  try {
    sesion.setMicrophoneActive?.(microfono);
    sesion.setCameraActive?.(camara);
  } catch {
    /* no admitido */
  }
}

export function terminarLlamada(): void {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  const sesion = navigator.mediaSession;
  sesion.metadata = null;
  sesion.playbackState = "none";
  for (const accion of ["togglemicrophone", "togglecamera", "hangup", "pause"]) {
    try {
      sesion.setActionHandler(accion as MediaSessionAction, null);
    } catch {
      /* no admitida */
    }
  }
}
