import type { MensajeCliente, MensajeServidor } from "./protocolo";
import { urlSenalizacion } from "./urlSenalizacion";

/**
 * Conexión WebSocket con el servidor. Entrega cada mensaje recibido y avisa del cierre; los
 * reintentos los decide quien la usa (la sesión), porque reconectar implica volver a unirse.
 */
export class ClienteSenal {
  private socket: WebSocket | null = null;
  private cerradoAProposito = false;

  constructor(
    private readonly alRecibir: (mensaje: MensajeServidor) => void,
    private readonly alCerrar: (inesperado: boolean) => void
  ) {}

  conectar(): Promise<void> {
    this.cerradoAProposito = false;
    return new Promise((resolver, rechazar) => {
      const socket = new WebSocket(urlSenalizacion());
      this.socket = socket;
      socket.onopen = () => resolver();
      socket.onerror = () => rechazar(new Error("No se pudo conectar con el servidor de la reunión."));
      socket.onmessage = (evento) => {
        try {
          this.alRecibir(JSON.parse(String(evento.data)) as MensajeServidor);
        } catch (error) {
          console.error("[Señal] Mensaje no válido", error);
        }
      };
      socket.onclose = () => {
        if (this.socket === socket) this.socket = null;
        this.alCerrar(!this.cerradoAProposito);
      };
    });
  }

  enviar(mensaje: MensajeCliente): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(mensaje));
  }

  /** Cierra como si se hubiera caído, para que la sesión vuelva a entrar. */
  reiniciar(): void {
    this.socket?.close(4000);
  }

  cerrar(): void {
    this.cerradoAProposito = true;
    this.socket?.close(1000);
    this.socket = null;
  }
}
