/**
 * Pantalla completa de una tesela. En escritorio y Android se usa la API estándar sobre la tesela
 * (conserva el nombre y los controles); en iPhone, donde solo el <video> puede ir a pantalla
 * completa, se usa la de WebKit. Si es una presentación, en el móvil se intenta girar a horizontal.
 */
type VideoWebkit = HTMLVideoElement & { webkitEnterFullscreen?: () => void; webkitSupportsFullscreen?: boolean };
type DocumentoWebkit = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
type ElementoWebkit = HTMLElement & { webkitRequestFullscreen?: () => void };
type Orientacion = ScreenOrientation & { lock?: (o: string) => Promise<void> };

export function elementoEnPantallaCompleta(): Element | null {
  const doc = document as DocumentoWebkit;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

export function salirDePantallaCompleta(): void {
  const doc = document as DocumentoWebkit;
  if (doc.fullscreenElement) void doc.exitFullscreen().catch(() => {});
  else doc.webkitExitFullscreen?.();
}

export async function ponerEnPantallaCompleta(elemento: HTMLElement, horizontal: boolean): Promise<void> {
  const el = elemento as ElementoWebkit;
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else throw new Error("sin API");
  } catch {
    const video = elemento.querySelector("video") as VideoWebkit | null;
    if (video?.webkitEnterFullscreen) video.webkitEnterFullscreen();
    return;
  }
  if (horizontal) {
    const orientacion = screen.orientation as Orientacion | undefined;
    await orientacion?.lock?.("landscape").catch(() => {}); // solo funciona en móviles; si no, se ignora
  }
}

export function soltarOrientacion(): void {
  try {
    screen.orientation?.unlock?.();
  } catch {
    /* no soportado */
  }
}
