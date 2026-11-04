/**
 * Cifrado de extremo a extremo de Ágora.
 *
 * Cada reunión tiene una clave secreta que viaja solo en el `#` del enlace (los navegadores nunca
 * envían esa parte al servidor) o que se teclea como contraseña. De ella salen, con PBKDF2 y HKDF:
 * - la clave de medios (AES-GCM) con la que se cifra cada fotograma de audio y vídeo,
 * - la clave de datos (AES-GCM) para el chat, los nombres y los archivos,
 * - la huella de acceso, lo único que ve el servidor: comprueba que todos traen la misma clave
 *   sin poder obtenerla ni descifrar nada con ella.
 */
const ALFABETO = "abcdefghijkmnpqrstuvwxyz23456789"; // sin l, o, 0 ni 1 para dictarla sin errores
const ITERACIONES = 210_000;
const VERSION = "e1.";

export interface ClavesReunion {
  medios: CryptoKey;
  mediosCrudos: ArrayBuffer;
  datos: CryptoKey;
  acceso: string;
}

let actuales: ClavesReunion | null = null;
export const clavesActuales = (): ClavesReunion | null => actuales;

/** Clave nueva de 20 caracteres (100 bits), en grupos de 5 para leerla en voz alta. */
export function generarSecreto(): string {
  const azar = crypto.getRandomValues(new Uint8Array(20));
  const letras = [...azar].map((n) => ALFABETO[n % ALFABETO.length]).join("");
  return letras.match(/.{5}/g)!.join("-");
}

/** Igual se escriba con o sin guiones, espacios o mayúsculas. */
export function normalizarSecreto(secreto: string): string {
  return secreto.normalize("NFC").toLowerCase().replace(/[\s-]+/g, "");
}

const texto = new TextEncoder();

export function aBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binario = "";
  for (let i = 0; i < u8.length; i += 0x8000) binario += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function deBase64Url(cadena: string): Uint8Array<ArrayBuffer> {
  const binario = atob(cadena.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

async function derivarBits(base: CryptoKey, info: string): Promise<ArrayBuffer> {
  return crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: texto.encode(info) }, base, 256);
}

/** Deriva las claves de la reunión. La sala hace de sal: la misma contraseña da claves distintas en cada sala. */
export async function prepararClaves(sala: string, secreto: string): Promise<ClavesReunion> {
  const pbkdf2 = await crypto.subtle.importKey("raw", texto.encode(normalizarSecreto(secreto)), "PBKDF2", false, ["deriveBits"]);
  const maestra = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: texto.encode(`agora/${sala}`), iterations: ITERACIONES }, pbkdf2, 256);
  const base = await crypto.subtle.importKey("raw", maestra, "HKDF", false, ["deriveBits"]);
  const [mediosCrudos, datosCrudos, acceso] = await Promise.all([derivarBits(base, "agora medios"), derivarBits(base, "agora datos"), derivarBits(base, "agora acceso")]);
  const aes = (bits: ArrayBuffer) => crypto.subtle.importKey("raw", bits, "AES-GCM", false, ["encrypt", "decrypt"]);
  actuales = { medios: await aes(mediosCrudos), mediosCrudos, datos: await aes(datosCrudos), acceso: aBase64Url(acceso) };
  return actuales;
}

export function olvidarClaves(): void {
  actuales = null;
}

function claveDatos(): CryptoKey {
  if (!actuales) throw new Error("Sin clave de la reunión");
  return actuales.datos;
}

/** Cifra bytes con la clave de datos: IV (12 bytes) seguido del texto cifrado con su etiqueta. */
export async function cifrarBytes(datos: ArrayBuffer | Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifrado = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, claveDatos(), datos);
  const salida = new Uint8Array(12 + cifrado.byteLength);
  salida.set(iv);
  salida.set(new Uint8Array(cifrado), 12);
  return salida;
}

export async function descifrarBytes(datos: ArrayBuffer | Uint8Array<ArrayBuffer>): Promise<ArrayBuffer> {
  const u8 = datos instanceof Uint8Array ? datos : new Uint8Array(datos);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: u8.subarray(0, 12) }, claveDatos(), u8.subarray(12));
}

export async function cifrarTexto(contenido: string): Promise<string> {
  return VERSION + aBase64Url(await cifrarBytes(texto.encode(contenido)));
}

/** Descifra un texto; si no se puede (otra clave, manipulado), devuelve `respaldo`. */
export async function descifrarTexto(cifrado: string, respaldo = "🔒 Ilegible"): Promise<string> {
  if (!cifrado.startsWith(VERSION)) return respaldo;
  try {
    return new TextDecoder().decode(await descifrarBytes(deBase64Url(cifrado.slice(VERSION.length))));
  } catch {
    return respaldo;
  }
}
