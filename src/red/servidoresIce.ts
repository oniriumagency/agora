import type { ServidorIce } from "./protocolo";

/**
 * Servidores ICE de las conexiones. STUN basta en redes domésticas; tras CGNAT o en datos móviles
 * hace falta TURN: el servidor envía al conectar credenciales temporales de Cloudflare. Sin ellas se
 * usa la configuración pública opcional NEXT_PUBLIC_TURN_* o solo STUN.
 */
const STUN: RTCIceServer = { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] };

function turnLocal(): RTCIceServer[] {
  const url = process.env.NEXT_PUBLIC_TURN_URL;
  if (!url) return [];
  return [{ urls: url.split(",").map((parte) => parte.trim()), username: process.env.NEXT_PUBLIC_TURN_USUARIO, credential: process.env.NEXT_PUBLIC_TURN_CLAVE }];
}

export function componerServidoresIce(delServidor: ServidorIce[]): RTCIceServer[] {
  const turn = delServidor.length > 0 ? delServidor.map(({ urls, username, credential }) => ({ urls, username, credential })) : turnLocal();
  return [STUN, ...turn];
}
