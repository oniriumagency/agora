import {
  LARGO_MAXIMO_CHAT,
  LARGO_MAXIMO_NOMBRE,
  PATRON_SALA,
  REACCIONES,
  type CambiosEstado,
  type CargaSenal,
  type MensajeCliente,
} from "./protocolo.ts";

/**
 * Valida cada mensaje de un cliente antes de procesarlo. Nada que llegue del navegador se da por
 * bueno: tipos, longitudes y valores permitidos se comprueban aquí y lo demás se descarta.
 */
type Objeto = Record<string, unknown>;
const LARGO_MAXIMO_SDP = 48_000;
const LARGO_MAXIMO_CANDIDATO = 1000;
const LARGO_MAXIMO_ID = 64;

const esObjeto = (valor: unknown): valor is Objeto => typeof valor === "object" && valor !== null && !Array.isArray(valor);
const esTexto = (valor: unknown, maximo: number): valor is string => typeof valor === "string" && valor.length <= maximo;
const esBooleano = (valor: unknown): valor is boolean => typeof valor === "boolean";

/** Quita caracteres de control y espacios sobrantes de un texto visible. */
export function limpiarTexto(texto: string): string {
  return texto.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "").trim();
}

function validarCarga(carga: unknown): CargaSenal | null {
  if (!esObjeto(carga)) return null;
  if ((carga.tipo === "offer" || carga.tipo === "answer") && esTexto(carga.sdp, LARGO_MAXIMO_SDP)) {
    return { tipo: carga.tipo, sdp: carga.sdp };
  }
  if (!esTexto(carga.candidate, LARGO_MAXIMO_CANDIDATO)) return null;
  const mid = carga.sdpMid;
  const indice = carga.sdpMLineIndex;
  const fragmento = carga.usernameFragment;
  if (mid !== null && !esTexto(mid, 32)) return null;
  if (indice !== null && !(Number.isInteger(indice) && (indice as number) >= 0 && (indice as number) < 16)) return null;
  if (fragmento !== undefined && fragmento !== null && !esTexto(fragmento, 256)) return null;
  return { candidate: carga.candidate, sdpMid: mid, sdpMLineIndex: indice as number | null, usernameFragment: fragmento ?? null };
}

function validarCambios(cambios: unknown): CambiosEstado | null {
  if (!esObjeto(cambios)) return null;
  const resultado: CambiosEstado = {};
  for (const clave of ["microfono", "camara", "pantalla", "mano"] as const) {
    const valor = cambios[clave];
    if (valor === undefined) continue;
    if (!esBooleano(valor)) return null;
    resultado[clave] = valor;
  }
  return Object.keys(resultado).length > 0 ? resultado : null;
}

export function validarMensaje(datos: unknown): MensajeCliente | null {
  if (!esObjeto(datos)) return null;
  switch (datos.tipo) {
    case "UNIRSE": {
      const estado = datos.estado;
      if (!esTexto(datos.sala, 60) || !PATRON_SALA.test(datos.sala)) return null;
      if (!esTexto(datos.nombre, 200) || !esObjeto(estado)) return null;
      if (!esBooleano(estado.microfono) || !esBooleano(estado.camara)) return null;
      const nombre = limpiarTexto(datos.nombre).slice(0, LARGO_MAXIMO_NOMBRE);
      if (!nombre) return null;
      return { tipo: "UNIRSE", sala: datos.sala, nombre, estado: { microfono: estado.microfono, camara: estado.camara } };
    }
    case "SENAL": {
      const carga = validarCarga(datos.carga);
      if (!carga || !esTexto(datos.destino, LARGO_MAXIMO_ID)) return null;
      return { tipo: "SENAL", destino: datos.destino, carga };
    }
    case "ESTADO": {
      const cambios = validarCambios(datos.cambios);
      return cambios ? { tipo: "ESTADO", cambios } : null;
    }
    case "CHAT": {
      if (!esTexto(datos.texto, LARGO_MAXIMO_CHAT * 2)) return null;
      const texto = limpiarTexto(datos.texto).slice(0, LARGO_MAXIMO_CHAT);
      return texto ? { tipo: "CHAT", texto } : null;
    }
    case "REACCION": {
      const emoji = REACCIONES.find((permitida) => permitida === datos.emoji);
      return emoji ? { tipo: "REACCION", emoji } : null;
    }
    default:
      return null;
  }
}
