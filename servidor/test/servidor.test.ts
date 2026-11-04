import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import WebSocket from "ws";
import type { MensajeServidor } from "../src/protocolo.ts";

process.env.MEET_MAXIMO_POR_SALA = "3";
const { crearServidor } = await import("../src/servidor.ts");
const PUERTO = 18_180;
let servidor: ReturnType<typeof crearServidor>;

before(() => {
  servidor = crearServidor(PUERTO);
});
after(() => servidor.cerrar());

/** Cliente de prueba que acumula los mensajes recibidos y permite esperar uno concreto. */
async function conectar() {
  const socket = new WebSocket(`ws://127.0.0.1:${PUERTO}`);
  const recibidos: MensajeServidor[] = [];
  const esperas: Array<() => void> = [];
  socket.on("message", (datos) => {
    recibidos.push(JSON.parse(datos.toString()));
    esperas.splice(0).forEach((despertar) => despertar());
  });
  await new Promise((resolver) => socket.once("open", resolver));
  const enviar = (mensaje: unknown) => socket.send(JSON.stringify(mensaje));
  async function esperar<T extends MensajeServidor["tipo"]>(tipo: T): Promise<Extract<MensajeServidor, { tipo: T }>> {
    for (;;) {
      const indice = recibidos.findIndex((mensaje) => mensaje.tipo === tipo);
      if (indice >= 0) return recibidos.splice(indice, 1)[0] as Extract<MensajeServidor, { tipo: T }>;
      await new Promise<void>((resolver, rechazar) => {
        esperas.push(resolver);
        setTimeout(() => rechazar(new Error(`sin ${tipo}`)), 2000);
      });
    }
  }
  const unirse = async (sala: string, nombre: string) => {
    enviar({ tipo: "UNIRSE", sala, nombre, estado: { microfono: true, camara: false } });
    return esperar("BIENVENIDA");
  };
  return { socket, enviar, esperar, unirse };
}

test("unirse, presencia y salida", async () => {
  const ana = await conectar();
  const bienvenidaAna = await ana.unirse("abc-defg-hij", "Ana");
  assert.deepEqual(bienvenidaAna.participantes, []);
  const beto = await conectar();
  const bienvenidaBeto = await beto.unirse("abc-defg-hij", "  Beto\u0007 ");
  assert.equal(bienvenidaBeto.participantes[0].nombre, "Ana");
  const entro = await ana.esperar("ENTRO");
  assert.equal(entro.participante.nombre, "Beto");
  beto.socket.close();
  assert.equal((await ana.esperar("SALIO")).id, bienvenidaBeto.miId);
  ana.socket.close();
});

test("señal con el remitente que fija el servidor", async () => {
  const ana = await conectar();
  const beto = await conectar();
  const { miId: idAna } = await ana.unirse("sala-senal", "Ana");
  const { miId: idBeto } = await beto.unirse("sala-senal", "Beto");
  ana.enviar({ tipo: "SENAL", destino: idBeto, carga: { tipo: "offer", sdp: "v=0" } });
  const senal = await beto.esperar("SENAL");
  assert.equal(senal.origen, idAna);
  beto.enviar({ tipo: "SENAL", destino: "inexistente", carga: { tipo: "answer", sdp: "v=0" } });
  assert.equal((await beto.esperar("ERROR")).codigo, "DESTINO_DESCONOCIDO");
  ana.socket.close();
  beto.socket.close();
});

test("estado, mano, chat con historial y reacciones", async () => {
  const ana = await conectar();
  const beto = await conectar();
  await ana.unirse("sala-chat", "Ana");
  await beto.unirse("sala-chat", "Beto");
  ana.enviar({ tipo: "ESTADO", cambios: { mano: true, microfono: false } });
  const estado = await beto.esperar("ESTADO");
  assert.equal(estado.estado.microfono, false);
  assert.equal(typeof estado.estado.mano, "number");
  ana.enviar({ tipo: "CHAT", texto: "  hola  " });
  assert.equal((await beto.esperar("CHAT")).mensaje.texto, "hola");
  ana.enviar({ tipo: "REACCION", emoji: "👍" });
  assert.equal((await beto.esperar("REACCION")).emoji, "👍");
  ana.enviar({ tipo: "REACCION", emoji: "💩" });
  assert.equal((await ana.esperar("ERROR")).codigo, "MENSAJE_INVALIDO");
  const carla = await conectar();
  const bienvenida = await carla.unirse("sala-chat", "Carla");
  assert.equal(bienvenida.chat.at(-1)?.texto, "hola");
  for (const cliente of [ana, beto, carla]) cliente.socket.close();
});

test("sala llena y validación", async () => {
  const clientes = await Promise.all([1, 2, 3, 4].map(() => conectar()));
  for (const [indice, cliente] of clientes.slice(0, 3).entries()) await cliente.unirse("sala-llena", `P${indice}`);
  clientes[3].enviar({ tipo: "UNIRSE", sala: "sala-llena", nombre: "Cuarto", estado: { microfono: true, camara: true } });
  assert.equal((await clientes[3].esperar("ERROR")).codigo, "SALA_LLENA");
  clientes[3].enviar({ tipo: "UNIRSE", sala: "../etc", nombre: "X", estado: { microfono: true, camara: true } });
  assert.equal((await clientes[3].esperar("ERROR")).codigo, "MENSAJE_INVALIDO");
  clientes[3].enviar({ tipo: "CHAT", texto: "hola" });
  assert.equal((await clientes[3].esperar("ERROR")).codigo, "NO_EN_SALA");
  clientes.forEach((cliente) => cliente.socket.close());
});
