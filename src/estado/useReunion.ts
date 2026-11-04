import { create } from "zustand";
import type { EstadoParticipante, MensajeChat, Participante, Reaccion } from "@/red/protocolo";
import type { FlujosPorPersona } from "@/red/ConexionSfu";
import type { Aviso, Destacado, EstadoLocal, Fase, Panel, ParticipanteRemoto, ReaccionVisible } from "./tipos";

/**
 * Estado de la reunión que pinta la interfaz. Lo modifican la sesión (mensajes del servidor y de
 * la conexión de medios) y los controles locales; los componentes solo leen y llaman a acciones de la sesión.
 */
interface EstadoReunion {
  fase: Fase;
  error: string | null;
  sala: string;
  miId: string | null;
  miNombre: string;
  local: EstadoLocal;
  participantes: Record<string, ParticipanteRemoto>;
  chat: MensajeChat[];
  noLeidos: number;
  panel: Panel;
  fijado: Destacado;
  /** Vista "solo esta persona": la tesela fijada ocupa todo, sin la tira del resto. */
  enfocado: boolean;
  avisos: Aviso[];
  reacciones: ReaccionVisible[];
  entradaEn: number | null;
  maximoVideos: number;
  /** Secreto de esta conexión para subir archivos al chat. */
  clave: string | null;
  maximoArchivoMB: number;
  pagina: number;
  /** Problema con el audio y el vídeo (la reunión sigue: chat, mano, etc.). */
  avisoMedios: string | null;

  fijar: (estado: Partial<EstadoReunion>) => void;
  fijarLocal: (cambios: Partial<EstadoLocal>) => void;
  abrirPanel: (panel: Panel) => void;
  alternarFijado: (destacado: Destacado) => void;
  enfocar: (destacado: NonNullable<Destacado>) => void;
  verTodos: () => void;
  ponerParticipantes: (lista: Participante[]) => void;
  agregarParticipante: (participante: Participante) => void;
  quitarParticipante: (id: string) => void;
  actualizarEstado: (id: string, estado: EstadoParticipante) => void;
  ponerFlujos: (flujos: FlujosPorPersona) => void;
  agregarChat: (mensaje: MensajeChat) => void;
  avisar: (texto: string, icono?: string) => void;
  mostrarReaccion: (emoji: Reaccion, nombre: string) => void;
}

export const LOCAL_INICIAL: EstadoLocal = {
  microfono: true,
  camara: true,
  pantalla: false,
  mano: null,
  pistaMicro: null,
  flujoMicro: null,
  flujoCamara: null,
  flujoPantalla: null,
};

let contadorAvisos = 0;
const DURACION_AVISO_MS = 4500;
const DURACION_REACCION_MS = 4000;

const remoto = (participante: Participante): ParticipanteRemoto => ({ ...participante, flujos: {} });

export const useReunion = create<EstadoReunion>((set) => ({
  fase: "previa",
  error: null,
  sala: "",
  miId: null,
  miNombre: "",
  local: LOCAL_INICIAL,
  participantes: {},
  chat: [],
  noLeidos: 0,
  panel: null,
  fijado: null,
  enfocado: false,
  avisos: [],
  reacciones: [],
  entradaEn: null,
  maximoVideos: 9,
  clave: null,
  maximoArchivoMB: 95,
  pagina: 0,
  avisoMedios: null,

  fijar: (estado) => set(estado),
  fijarLocal: (cambios) => set((actual) => ({ local: { ...actual.local, ...cambios } })),
  abrirPanel: (panel) => set((actual) => ({ panel: actual.panel === panel ? null : panel, noLeidos: panel === "chat" ? 0 : actual.noLeidos })),
  alternarFijado: (destacado) =>
    set((actual) => ({
      fijado: actual.fijado && destacado && actual.fijado.id === destacado.id && actual.fijado.pantalla === destacado.pantalla ? null : destacado,
      enfocado: false,
    })),
  enfocar: (destacado) => set({ fijado: destacado, enfocado: true }),
  verTodos: () => set({ fijado: null, enfocado: false }),
  ponerParticipantes: (lista) => set({ participantes: Object.fromEntries(lista.map((participante) => [participante.id, remoto(participante)])) }),
  agregarParticipante: (participante) => set((actual) => ({ participantes: { ...actual.participantes, [participante.id]: remoto(participante) } })),
  quitarParticipante: (id) =>
    set((actual) => {
      const { [id]: _quitado, ...resto } = actual.participantes;
      return { participantes: resto, fijado: actual.fijado?.id === id ? null : actual.fijado };
    }),
  actualizarEstado: (id, estado) =>
    set((actual) => {
      const participante = actual.participantes[id];
      if (!participante) return {};
      const fijado = actual.fijado?.id === id && actual.fijado.pantalla && !estado.pantalla ? null : actual.fijado;
      return { participantes: { ...actual.participantes, [id]: { ...participante, estado } }, fijado };
    }),
  ponerFlujos: (flujos) =>
    set((actual) => {
      const participantes: Record<string, ParticipanteRemoto> = {};
      for (const [id, participante] of Object.entries(actual.participantes)) participantes[id] = { ...participante, flujos: flujos[id] ?? {} };
      return { participantes };
    }),
  agregarChat: (mensaje) =>
    set((actual) => ({
      chat: [...actual.chat, mensaje].slice(-300),
      noLeidos: actual.panel === "chat" || mensaje.autorId === actual.miId ? actual.noLeidos : actual.noLeidos + 1,
    })),
  avisar: (texto, icono) => {
    const id = ++contadorAvisos;
    set((actual) => ({ avisos: [...actual.avisos.slice(-3), { id, texto, icono }] }));
    setTimeout(() => set((actual) => ({ avisos: actual.avisos.filter((aviso) => aviso.id !== id) })), DURACION_AVISO_MS);
  },
  mostrarReaccion: (emoji, nombre) => {
    const id = ++contadorAvisos;
    set((actual) => ({ reacciones: [...actual.reacciones.slice(-20), { id, emoji, nombre, izquierda: 5 + Math.random() * 25 }] }));
    setTimeout(() => set((actual) => ({ reacciones: actual.reacciones.filter((reaccion) => reaccion.id !== id) })), DURACION_REACCION_MS);
  },
}));
