import { configuracion } from "./entorno.ts";
import type { ServidorIce } from "./protocolo.ts";

/**
 * Credenciales TURN temporales de Cloudflare Realtime (mismo mecanismo que Kubox).
 *
 * Con MEET_TURN_CLOUDFLARE_ID y MEET_TURN_CLOUDFLARE_TOKEN (secreto de servidor, nunca llega al
 * navegador) se pide a la API un juego de servidores ICE con caducidad y se comparte entre todos
 * los clientes hasta la mitad de su vida. Sin configuración o ante un fallo devuelve [].
 * https://developers.cloudflare.com/realtime/turn/generate-credentials/
 */
const URL_API = "https://rtc.live.cloudflare.com/v1/turn/keys";
const ESPERA_MAXIMA_API_MS = 5000;
const ESPERA_TRAS_FALLO_MS = 60_000;
const URLS_MAXIMAS = 12;

let vigentes: { servidores: ServidorIce[]; renovarEn: number } | null = null;
let pendiente: Promise<ServidorIce[]> | null = null;
let siguienteIntento = 0;

export function turnConfigurado(): boolean {
  return configuracion.turnId !== "" && configuracion.turnToken !== "";
}

/** Normaliza `iceServers` (lista u objeto) y descarta el puerto 53, que los navegadores bloquean. */
export function normalizarServidoresIce(datos: unknown): ServidorIce[] {
  if (typeof datos !== "object" || datos === null || !("iceServers" in datos)) return [];
  const crudos: unknown = datos.iceServers;
  const servidores: ServidorIce[] = [];
  for (const entrada of Array.isArray(crudos) ? crudos : [crudos]) {
    if (typeof entrada !== "object" || entrada === null || !("urls" in entrada)) continue;
    const urlsCrudas: unknown = entrada.urls;
    const urls = (Array.isArray(urlsCrudas) ? urlsCrudas : [urlsCrudas])
      .filter((url): url is string => typeof url === "string" && /^(stun|turns?):/.test(url) && !/:53(\?|$)/.test(url))
      .slice(0, URLS_MAXIMAS);
    if (urls.length === 0) continue;
    const username = "username" in entrada && typeof entrada.username === "string" ? entrada.username : undefined;
    const credential = "credential" in entrada && typeof entrada.credential === "string" ? entrada.credential : undefined;
    servidores.push({ urls, ...(username ? { username } : {}), ...(credential ? { credential } : {}) });
  }
  return servidores;
}

async function pedirACloudflare(): Promise<ServidorIce[]> {
  const ttl = configuracion.turnTtl;
  const respuesta = await fetch(`${URL_API}/${encodeURIComponent(configuracion.turnId)}/credentials/generate-ice-servers`, {
    method: "POST",
    headers: { Authorization: `Bearer ${configuracion.turnToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ttl }),
    signal: AbortSignal.timeout(ESPERA_MAXIMA_API_MS),
  });
  if (!respuesta.ok) throw new Error(`la API de Cloudflare respondió ${respuesta.status}`);
  const servidores = normalizarServidoresIce(await respuesta.json());
  if (servidores.length === 0) throw new Error("la API de Cloudflare no devolvió servidores ICE");
  vigentes = { servidores, renovarEn: Date.now() + (ttl * 1000) / 2 };
  console.log(`[TURN] Credenciales temporales de Cloudflare renovadas (TTL ${ttl} s).`);
  return servidores;
}

/** Servidores ICE para un cliente nuevo. Nunca rechaza: ante un fallo devuelve los últimos o []. */
export async function obtenerServidoresIce(): Promise<ServidorIce[]> {
  if (!turnConfigurado()) return [];
  if (vigentes && Date.now() < vigentes.renovarEn) return vigentes.servidores;
  if (Date.now() < siguienteIntento) return vigentes?.servidores ?? [];
  pendiente ??= pedirACloudflare()
    .catch((error: unknown) => {
      siguienteIntento = Date.now() + ESPERA_TRAS_FALLO_MS;
      console.error(`[TURN] No se pudieron obtener credenciales: ${error instanceof Error ? error.message : String(error)}`);
      return vigentes?.servidores ?? [];
    })
    .finally(() => {
      pendiente = null;
    });
  return pendiente;
}
