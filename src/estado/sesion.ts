import { ClienteSenal } from "@/red/ClienteSenal";
import { MallaWebRtc } from "@/red/MallaWebRtc";
import type { MensajeServidor, ServidorIce } from "@/red/protocolo";
import { componerServidoresIce } from "@/red/servidoresIce";
import { useReunion, LOCAL_INICIAL } from "./useReunion";
import { pistasLocales, soltarMedios } from "./controlesLocales";

/**
 * Ciclo de vida de una reunión: conectar al servidor, unirse, crear la malla WebRTC y traducir
 * los mensajes del servidor al estado de la interfaz. Si la conexión con el servidor se cae se
 * reintenta unirse, rehaciendo la malla (los demás verán que salimos y volvimos a entrar).
 */
const REINTENTOS_MAXIMOS = 8;
const ESPERA_SERVIDORES_ICE_MS = 2500;

let cliente: ClienteSenal | null = null;
let malla: MallaWebRtc | null = null;
let servidoresIce: ServidorIce[] | null = null;
let alLlegarIce: (() => void) | null = null;
let reintentos = 0;

const estado = () => useReunion.getState();

export const enviarAlServidor = (...argumentos: Parameters<ClienteSenal["enviar"]>): void => cliente?.enviar(...argumentos);
export const mallaActual = (): MallaWebRtc | null => malla;
const nombreDe = (id: string): string => estado().participantes[id]?.nombre ?? "Alguien";

function crearMalla(): MallaWebRtc {
  const nueva = new MallaWebRtc(componerServidoresIce(servidoresIce ?? []), {
    enviarSenal: (destino, carga) => cliente?.enviar({ tipo: "SENAL", destino, carga }),
    alRecibirPista: (id, tipo, flujo) => estado().ponerFlujo(id, tipo, flujo),
    alCambiarConexion: (id, conexion) => estado().ponerConexion(id, conexion),
  });
  const pistas = pistasLocales();
  for (const tipo of ["audio", "camara", "pantalla"] as const) void nueva.fijarPista(tipo, pistas[tipo]);
  return nueva;
}

function alRecibir(mensaje: MensajeServidor): void {
  const s = estado();
  switch (mensaje.tipo) {
    case "SERVIDORES_ICE":
      servidoresIce = mensaje.servidores;
      alLlegarIce?.();
      return;
    case "BIENVENIDA":
      reintentos = 0;
      malla?.cerrarTodo();
      malla = crearMalla();
      s.ponerParticipantes(mensaje.participantes);
      s.fijar({ fase: "reunion", miId: mensaje.miId, chat: mensaje.chat, error: null, entradaEn: s.entradaEn ?? Date.now() });
      for (const participante of mensaje.participantes) void malla.ofrecerA(participante.id);
      return;
    case "ENTRO":
      s.agregarParticipante(mensaje.participante);
      s.avisar(`${mensaje.participante.nombre} se unió`, "👋");
      return;
    case "SALIO":
      if (s.participantes[mensaje.id]) s.avisar(`${nombreDe(mensaje.id)} salió de la reunión`);
      malla?.cerrarPar(mensaje.id);
      s.quitarParticipante(mensaje.id);
      return;
    case "ESTADO": {
      const anterior = s.participantes[mensaje.id]?.estado;
      if (anterior && anterior.mano === null && mensaje.estado.mano !== null) s.avisar(`${nombreDe(mensaje.id)} levantó la mano`, "✋");
      if (anterior && !anterior.pantalla && mensaje.estado.pantalla) s.avisar(`${nombreDe(mensaje.id)} está presentando`, "🖥️");
      if (mensaje.id === s.miId) s.fijarLocal({ mano: mensaje.estado.mano });
      else s.actualizarEstado(mensaje.id, mensaje.estado);
      return;
    }
    case "CHAT":
      s.agregarChat(mensaje.mensaje);
      if (s.panel !== "chat" && mensaje.mensaje.autorId !== s.miId) s.avisar(`${mensaje.mensaje.autorNombre}: ${mensaje.mensaje.texto.slice(0, 80)}`, "💬");
      return;
    case "REACCION":
      s.mostrarReaccion(mensaje.emoji, mensaje.id === s.miId ? "Tú" : nombreDe(mensaje.id));
      return;
    case "SENAL":
      void malla?.recibirSenal(mensaje.origen, mensaje.carga).catch((error) => console.warn("[Sesión] Señal", error));
      return;
    case "ERROR":
      if (mensaje.codigo === "SALA_LLENA" || mensaje.codigo === "LIMITE_SALAS") {
        s.fijar({ fase: "error", error: mensaje.mensaje });
        cliente?.cerrar();
      } else console.warn(`[Servidor] ${mensaje.codigo}: ${mensaje.mensaje}`);
  }
}

function esperarServidoresIce(): Promise<void> {
  if (servidoresIce) return Promise.resolve();
  return new Promise((resolver) => {
    alLlegarIce = resolver;
    setTimeout(resolver, ESPERA_SERVIDORES_ICE_MS);
  });
}

function alCerrar(inesperado: boolean): void {
  const s = estado();
  if (!inesperado || (s.fase !== "reunion" && s.fase !== "reconectando")) return;
  malla?.cerrarTodo();
  s.fijar({ fase: "reconectando", participantes: {} });
  if (++reintentos > REINTENTOS_MAXIMOS) {
    s.fijar({ fase: "error", error: "Se perdió la conexión con el servidor de la reunión." });
    return;
  }
  setTimeout(() => void conectarYUnirse().catch(() => undefined), Math.min(1000 * reintentos, 5000));
}

async function conectarYUnirse(): Promise<void> {
  servidoresIce = null;
  cliente = new ClienteSenal(alRecibir, alCerrar);
  await cliente.conectar();
  await esperarServidoresIce();
  const { sala, miNombre, local } = estado();
  cliente.enviar({ tipo: "UNIRSE", sala, nombre: miNombre, estado: { microfono: local.microfono, camara: local.camara } });
}

export async function entrar(sala: string, nombre: string): Promise<void> {
  reintentos = 0;
  estado().fijar({ fase: "conectando", sala, miNombre: nombre, error: null, chat: [], noLeidos: 0, entradaEn: null });
  try {
    await conectarYUnirse();
  } catch (error) {
    estado().fijar({ fase: "error", error: error instanceof Error ? error.message : String(error) });
  }
}

function cerrarTodo(): void {
  cliente?.cerrar();
  cliente = null;
  malla?.cerrarTodo();
  malla = null;
  soltarMedios();
  estado().fijar({ participantes: {}, miId: null, local: LOCAL_INICIAL, fijado: null, panel: null, entradaEn: null });
}

/** Colgar: se cierra todo y se muestra la pantalla final. */
export function salir(): void {
  cerrarTodo();
  estado().fijar({ fase: "fuera" });
}

/** Al abandonar la página de la reunión (navegación): se cierra todo sin cambiar de pantalla. */
export function abandonarPagina(): void {
  cerrarTodo();
}
