import { ClienteSenal } from "@/red/ClienteSenal";
import { ConexionSfu, type FlujosPorPersona } from "@/red/ConexionSfu";
import type { MensajeServidor, ServidorIce } from "@/red/protocolo";
import { componerServidoresIce } from "@/red/servidoresIce";
import { useReunion, LOCAL_INICIAL } from "./useReunion";
import { pistasLocales, soltarMedios } from "./controlesLocales";

/**
 * Ciclo de vida de una reunión: conectar al servidor, unirse, abrir la conexión WebRTC con el SFU
 * y traducir los mensajes del servidor al estado de la interfaz. Si se cae la señalización o los
 * medios, se vuelve a entrar (los demás verán que salimos y volvimos).
 */
const REINTENTOS_MAXIMOS = 8;
const ESPERA_SERVIDORES_ICE_MS = 2500;

let cliente: ClienteSenal | null = null;
let medios: ConexionSfu | null = null;
let ultimosFlujos: FlujosPorPersona = {};
let ultimaSuscripcion = "";
let servidoresIce: ServidorIce[] | null = null;
let alLlegarIce: (() => void) | null = null;
let reintentos = 0;

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
    case "BIENVENIDA":
      reintentos = 0;
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
      return;
    case "SALIO":
      if (s.participantes[mensaje.id]) s.avisar(`${nombreDe(mensaje.id)} salió de la reunión`);
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
  medios?.cerrar();
  medios = null;
  soltarMedios();
  estado().fijar({ participantes: {}, miId: null, local: LOCAL_INICIAL, fijado: null, enfocado: false, panel: null, entradaEn: null });
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
