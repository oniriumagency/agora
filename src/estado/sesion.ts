import { ClienteSenal } from "@/red/ClienteSenal";
import { ConexionSfu, type FlujosPorPersona } from "@/red/ConexionSfu";
import type { MensajeServidor, ServidorIce } from "@/red/protocolo";
import { componerServidoresIce } from "@/red/servidoresIce";
import { useReunion, LOCAL_INICIAL } from "./useReunion";
import { pistasLocales, recuperarPistas, soltarMedios } from "./controlesLocales";
import { sonarEntrada, sonarSalida } from "@/medios/sonidos";
import { mantenerPantallaEncendida, soltarPantallaEncendida } from "@/medios/pantallaEncendida";

/**
 * Ciclo de vida de una reunión: conectar al servidor, unirse, abrir la conexión WebRTC con el SFU
 * y traducir los mensajes del servidor al estado de la interfaz.
 *
 * En el celular la conexión se corta a menudo sin querer: al bloquear la pantalla, cambiar de app o
 * de red. Entonces se reconecta con la clave de la conexión anterior y el servidor nos devuelve el
 * mismo sitio (los demás solo ven «Reconectando…» un momento). Mientras la página está oculta no se
 * gastan reintentos: se reconecta en cuanto vuelve a verse.
 */
const RENDIRSE_TRAS_MS = 3 * 60_000;
const ESPERA_PONG_MS = 3500;
const ESPERA_SERVIDORES_ICE_MS = 2500;

let cliente: ClienteSenal | null = null;
let medios: ConexionSfu | null = null;
let ultimosFlujos: FlujosPorPersona = {};
let ultimaSuscripcion = "";
let servidoresIce: ServidorIce[] | null = null;
let alLlegarIce: (() => void) | null = null;
let reintentos = 0;
let caidaDesde: number | null = null;
let temporizadorReintento: ReturnType<typeof setTimeout> | null = null;
let alPong: (() => void) | null = null;

const estado = () => useReunion.getState();

export const enviarAlServidor = (...argumentos: Parameters<ClienteSenal["enviar"]>): void => cliente?.enviar(...argumentos);
export const conexionActual = (): ConexionSfu | null => medios;
const nombreDe = (id: string): string => estado().participantes[id]?.nombre ?? "Alguien";

function crearMedios(): ConexionSfu {
  const conexion = new ConexionSfu(componerServidoresIce(servidoresIce ?? []), {
    enviarSenal: (carga) => cliente?.enviar({ tipo: "SENAL", carga }),
    alCambiarFlujos: (flujos) => {
      ultimosFlujos = flujos;
      estado().ponerFlujos(flujos);
    },
    alFallar: (nuncaConecto) => {
      if (!nuncaConecto) return cliente?.reiniciar();
      // Volver a entrar no lo arreglaría: se avisa y se sigue en la reunión sin medios
      medios?.cerrar();
      estado().fijar({
        avisoMedios:
          "No se pudo conectar el audio y el vídeo con el servidor de la reunión. Tu red no llega a su puerto de vídeo: quien organiza debe abrir el puerto en su router o configurar TURN.",
      });
    },
  });
  void conexion.iniciar(pistasLocales()).catch((error) => console.error("[Sesión] No se pudo iniciar la conexión de medios", error));
  return conexion;
}

/** Pide al servidor el vídeo de las personas que se ven en pantalla (lo demás no se descarga). */
export function suscribir(ids: string[]): void {
  const firma = ids.join(",");
  if (firma === ultimaSuscripcion) return;
  ultimaSuscripcion = firma;
  cliente?.enviar({ tipo: "SUSCRIBIR", videos: ids });
}

function ajustarCalidad(): void {
  void medios?.ajustarCalidad(Object.keys(estado().participantes).length + 1);
}

function alRecibir(mensaje: MensajeServidor): void {
  const s = estado();
  switch (mensaje.tipo) {
    case "SERVIDORES_ICE":
      servidoresIce = mensaje.servidores;
      alLlegarIce?.();
      return;
    case "PONG":
      alPong?.();
      return;
    case "BIENVENIDA":
      reintentos = 0;
      caidaDesde = null;
      void mantenerPantallaEncendida();
      medios?.cerrar();
      s.fijar({ avisoMedios: null });
      ultimosFlujos = {};
      ultimaSuscripcion = "";
      s.ponerParticipantes(mensaje.participantes);
      s.fijar({ fase: "reunion", miId: mensaje.miId, chat: mensaje.chat, error: null, entradaEn: s.entradaEn ?? Date.now(), maximoVideos: mensaje.maximoVideos || 9, clave: mensaje.clave ?? null, maximoArchivoMB: mensaje.maximoArchivoMB || 95 });
      medios = crearMedios();
      ajustarCalidad();
      return;
    case "ENTRO":
      s.agregarParticipante(mensaje.participante);
      s.ponerFlujos(ultimosFlujos);
      ajustarCalidad();
      s.avisar(`${mensaje.participante.nombre} se unió`, "👋");
      sonarEntrada();
      return;
    case "SALIO":
      if (s.participantes[mensaje.id]) {
        s.avisar(`${nombreDe(mensaje.id)} salió de la reunión`);
        sonarSalida();
      }
      s.quitarParticipante(mensaje.id);
      ajustarCalidad();
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
      if (s.panel !== "chat" && mensaje.mensaje.autorId !== s.miId) s.avisar(
          mensaje.mensaje.archivo
            ? `${mensaje.mensaje.autorNombre} compartió ${mensaje.mensaje.archivo.nombre.slice(0, 60)}`
            : `${mensaje.mensaje.autorNombre}: ${mensaje.mensaje.texto.slice(0, 80)}`,
          mensaje.mensaje.archivo ? "📎" : "💬",
        );
      return;
    case "REACCION":
      s.mostrarReaccion(mensaje.emoji, mensaje.id === s.miId ? "Tú" : nombreDe(mensaje.id));
      return;
    case "SENAL":
      void medios?.recibirSenal(mensaje.carga).catch((error) => console.warn("[Sesión] Señal", error));
      return;
    case "PISTAS":
      medios?.fijarMapa(mensaje.mapa);
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
  medios?.cerrar();
  medios = null;
  // Se conservan las personas en pantalla: al volver, el servidor confirma quién sigue
  s.fijar({ fase: "reconectando" });
  caidaDesde ??= Date.now();
  programarReintento();
}

function programarReintento(): void {
  if (temporizadorReintento) clearTimeout(temporizadorReintento);
  temporizadorReintento = null;
  if (document.hidden) return; // se reintenta al volver a la página (ver alVolver)
  if (caidaDesde !== null && Date.now() - caidaDesde > RENDIRSE_TRAS_MS) {
    estado().fijar({ fase: "error", error: "Se perdió la conexión con el servidor de la reunión." });
    return;
  }
  const espera = Math.min(800 * ++reintentos, 5000);
  temporizadorReintento = setTimeout(() => {
    temporizadorReintento = null;
    void conectarYUnirse().catch(() => programarReintento());
  }, espera);
}

async function conectarYUnirse(): Promise<void> {
  servidoresIce = null;
  const { clave: claveAnterior, fase } = estado();
  cliente = new ClienteSenal(alRecibir, alCerrar);
  await cliente.conectar();
  await esperarServidoresIce();
  const { sala, miNombre, local } = estado();
  cliente.enviar({
    tipo: "UNIRSE",
    sala,
    nombre: miNombre,
    estado: { microfono: local.microfono, camara: local.camara, pantalla: local.pantalla },
    reanudar: fase === "reconectando" && claveAnterior ? claveAnterior : undefined,
  });
}

/** ¿Sigue viva la conexión? Al volver del segundo plano un WebSocket puede parecer abierto y estar muerto. */
function comprobarConexion(): Promise<boolean> {
  if (!cliente?.abierta()) return Promise.resolve(false);
  return new Promise((resolver) => {
    const tiempo = setTimeout(() => {
      alPong = null;
      resolver(false);
    }, ESPERA_PONG_MS);
    alPong = () => {
      clearTimeout(tiempo);
      alPong = null;
      resolver(true);
    };
    cliente?.enviar({ tipo: "PING" });
  });
}

/** La página vuelve a verse (se desbloqueó el celular, se volvió a la app) o volvió la red. */
async function alVolver(): Promise<void> {
  const s = estado();
  if (document.hidden || (s.fase !== "reunion" && s.fase !== "reconectando")) return;
  await recuperarPistas(); // iOS apaga cámara y micrófono en segundo plano
  void mantenerPantallaEncendida();
  if (s.fase === "reconectando") {
    reintentos = 0;
    caidaDesde = Date.now();
    if (temporizadorReintento) clearTimeout(temporizadorReintento);
    temporizadorReintento = null;
    void conectarYUnirse().catch(() => programarReintento());
    return;
  }
  if (!(await comprobarConexion())) cliente?.reiniciar();
}

if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => void alVolver());
  window.addEventListener("online", () => void alVolver());
  window.addEventListener("pageshow", (evento) => evento.persisted && void alVolver());
  // Cerrar la pestaña o irse a otra página es colgar: que el servidor no guarde el sitio
  window.addEventListener("pagehide", (evento) => {
    if (!evento.persisted) cliente?.enviar({ tipo: "SALIR" });
  });
}

export async function entrar(sala: string, nombre: string): Promise<void> {
  reintentos = 0;
  caidaDesde = null;
  estado().fijar({ fase: "conectando", sala, miNombre: nombre, error: null, chat: [], noLeidos: 0, entradaEn: null });
  try {
    await conectarYUnirse();
  } catch (error) {
    estado().fijar({ fase: "error", error: error instanceof Error ? error.message : String(error) });
  }
}

function cerrarTodo(): void {
  if (temporizadorReintento) clearTimeout(temporizadorReintento);
  temporizadorReintento = null;
  void soltarPantallaEncendida();
  cliente?.cerrar();
  cliente = null;
  medios?.cerrar();
  medios = null;
  soltarMedios();
  estado().fijar({ participantes: {}, miId: null, local: LOCAL_INICIAL, fijado: null, enfocado: false, panel: null, entradaEn: null, clave: null });
}

/** Reintenta el audio y el vídeo volviendo a entrar en la reunión. */
export function reintentarMedios(): void {
  estado().fijar({ avisoMedios: null });
  cliente?.reiniciar();
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
