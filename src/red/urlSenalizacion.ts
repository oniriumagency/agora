/**
 * Dirección del WebSocket de señalización.
 * - NEXT_PUBLIC_URL_SENALIZACION, si está definida.
 * - En desarrollo (`npm run dev`): el servidor local en el puerto 8180 del mismo equipo.
 * - En producción: el mismo dominio de la web, ruta /senal (el túnel de Cloudflare la envía al
 *   servidor de señalización), así no hace falta configurar nada en el cliente.
 */
export function urlSenalizacion(): string {
  const configurada = process.env.NEXT_PUBLIC_URL_SENALIZACION;
  if (configurada) return configurada;
  const { protocol, hostname, host } = window.location;
  if (process.env.NODE_ENV === "development") return `ws://${hostname}:8180`;
  return `${protocol === "https:" ? "wss" : "ws"}://${host}/senal`;
}
