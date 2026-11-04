import { MINIMO_LETRAS_SALA, PATRON_SALA } from "@/red/protocolo";

/** Códigos de reunión al estilo "abc-defg-hij", generados con el azar criptográfico del navegador. */
const LETRAS = "abcdefghijkmnopqrstuvwxyz";

function bloque(largo: number): string {
  const azar = crypto.getRandomValues(new Uint32Array(largo));
  return [...azar].map((numero) => LETRAS[numero % LETRAS.length]).join("");
}

export function generarCodigoSala(): string {
  return `${bloque(3)}-${bloque(4)}-${bloque(3)}`;
}

/** Acepta un código o un enlace completo de reunión; devuelve el código o null si no es válido. */
export function interpretarCodigo(entrada: string): string | null {
  let texto = entrada.split("#")[0].trim().toLowerCase();
  if (texto.includes("/")) texto = texto.split(/[?#]/)[0].replace(/\/+$/, "").split("/").pop() ?? "";
  texto = texto.replace(/\s+/g, "");
  return PATRON_SALA.test(texto) && texto.replace(/-/g, "").length >= MINIMO_LETRAS_SALA ? texto : null;
}

/** La clave que trae un enlace pegado (lo que va tras el #), si la trae. */
export function secretoDeEnlace(entrada: string): string | null {
  const indice = entrada.indexOf("#");
  if (indice < 0) return null;
  const crudo = entrada.slice(indice + 1).trim();
  try {
    return decodeURIComponent(crudo) || null;
  } catch {
    return crudo || null;
  }
}

/** Enlace completo para invitar: la clave va tras el #, que el navegador nunca envía al servidor. */
export function enlaceDeSala(codigo: string, secreto: string | null): string {
  return `${window.location.origin}/${codigo}${secreto ? `#${encodeURIComponent(secreto)}` : ""}`;
}
