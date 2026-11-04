import { PATRON_SALA } from "@/red/protocolo";

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
  let texto = entrada.trim().toLowerCase();
  if (texto.includes("/")) texto = texto.split(/[?#]/)[0].replace(/\/+$/, "").split("/").pop() ?? "";
  texto = texto.replace(/\s+/g, "");
  return PATRON_SALA.test(texto) ? texto : null;
}

export function enlaceDeSala(codigo: string): string {
  return `${window.location.origin}/${codigo}`;
}
