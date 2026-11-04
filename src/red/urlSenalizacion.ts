/**
 * Dirección del WebSocket de señalización.
 * - NEXT_PUBLIC_URL_SENALIZACION, si está definida.
 * - En desarrollo (`npm run dev`): el servidor Go del mismo equipo, puerto 8090.
 * - Si no: el mismo origen que sirve la web, ruta /senal. El servidor incluye la web, así que vale
 *   igual para localhost, la red local (HTTPS propio) y el enlace público del túnel.
 */
export function urlSenalizacion(): string {
  const configurada = process.env.NEXT_PUBLIC_URL_SENALIZACION;
  if (configurada) return configurada;
  const { protocol, hostname, host } = window.location;
  if (process.env.NODE_ENV === "development") return `ws://${hostname}:8090/senal`;
  return `${protocol === "https:" ? "wss" : "ws"}://${host}/senal`;
}

/** Dirección HTTP del servidor de la reunión (la misma máquina que la señalización). */
export function urlServidor(): string {
  return urlSenalizacion().replace(/^ws/, "http").replace(/\/senal$/, "");
}
