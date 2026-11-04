import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Carga el `.env.local` del proyecto (si existe) antes de que el resto de módulos lea su
 * configuración. Las variables ya definidas en el proceso prevalecen. Primera importación de servidor.ts.
 */
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const candidatos = [path.join(process.cwd(), ".env.local"), path.join(raiz, ".env.local")];
const archivo = candidatos.find((candidato) => existsSync(candidato));
if (archivo) process.loadEnvFile(archivo);

function numero(nombre: string, porDefecto: number): number {
  const valor = Number(process.env[nombre]);
  return Number.isFinite(valor) && valor > 0 ? valor : porDefecto;
}

export const configuracion = {
  puerto: numero("PUERTO", 8180),
  maximoConexiones: numero("MEET_MAXIMO_CONEXIONES", 500),
  maximoConexionesPorIp: numero("MEET_MAXIMO_CONEXIONES_POR_IP", 20),
  maximoSalas: numero("MEET_MAXIMO_SALAS", 200),
  maximoPorSala: numero("MEET_MAXIMO_POR_SALA", 8),
  confiarProxy: process.env.MEET_CONFIAR_PROXY === "true",
  origenesPermitidos: new Set(
    (process.env.MEET_ORIGENES_PERMITIDOS ?? "")
      .split(",")
      .map((origen) => origen.trim())
      .filter(Boolean)
  ),
  turnId: process.env.MEET_TURN_CLOUDFLARE_ID ?? "",
  turnToken: process.env.MEET_TURN_CLOUDFLARE_TOKEN ?? "",
  turnTtl: Math.max(numero("MEET_TURN_TTL_SEGUNDOS", 86400), 600),
};
