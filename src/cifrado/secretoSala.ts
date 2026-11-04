/**
 * Dónde vive la clave de la reunión en el navegador. Llega en el `#` del enlace; al abrirlo se
 * guarda en sessionStorage (solo esta pestaña) y se quita de la barra de direcciones para que no
 * quede a la vista al compartir pantalla ni en el historial.
 */
import { secretoDeEnlace } from "@/utilidades/codigoSala";

const prefijo = "agora.clave.";

export function tomarSecretoDeUrl(sala: string): void {
  const hash = window.location.hash.slice(1);
  if (!hash) return;
  guardarSecreto(sala, secretoDeEnlace(`#${hash}`) ?? hash);
  history.replaceState(history.state, "", window.location.pathname + window.location.search);
}

export function guardarSecreto(sala: string, secreto: string): void {
  try {
    sessionStorage.setItem(prefijo + sala, secreto);
  } catch {
    memoria.set(sala, secreto);
  }
}

const memoria = new Map<string, string>();

export function secretoDe(sala: string): string | null {
  try {
    return sessionStorage.getItem(prefijo + sala) ?? memoria.get(sala) ?? null;
  } catch {
    return memoria.get(sala) ?? null;
  }
}

export function olvidarSecreto(sala: string): void {
  memoria.delete(sala);
  try {
    sessionStorage.removeItem(prefijo + sala);
  } catch {
    /* sin almacenamiento */
  }
}
