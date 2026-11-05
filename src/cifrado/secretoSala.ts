/**
 * Dónde vive la clave de la reunión en el navegador. Llega en el `#` del enlace y se guarda en
 * sessionStorage (solo esta pestaña). Se deja en la barra de direcciones: la gente comparte la
 * reunión copiando esa dirección, y sin la clave el enlace no sirve para entrar.
 */
import { secretoDeEnlace } from "@/utilidades/codigoSala";

const prefijo = "agora.clave.";

export function tomarSecretoDeUrl(sala: string): void {
  const hash = window.location.hash.slice(1);
  if (!hash) return;
  guardarSecreto(sala, secretoDeEnlace(`#${hash}`) ?? hash);
}

/** Si la clave se tecleó, se pone en la barra de direcciones para que el enlace copiado la lleve. */
export function mostrarSecretoEnUrl(sala: string): void {
  const secreto = secretoDe(sala);
  if (secreto && !window.location.hash) history.replaceState(history.state, "", `${window.location.pathname}#${encodeURIComponent(secreto)}`);
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
