/**
 * Audio de reconexión cifrado. El servidor guarda los paquetes Opus tal como llegan (cifrados
 * de extremo a extremo) y los entrega dentro de un Ogg; aquí se descifra cada paquete y se
 * reconstruye el Ogg para que el navegador pueda decodificarlo. Las tramas de silencio que añade
 * el servidor para rellenar huecos van en claro y se dejan como están.
 */
const SILENCIO = [0xf8, 0xff, 0xfe];

const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let j = 0; j < 8; j++) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1;
    tabla[i] = r >>> 0;
  }
  return tabla;
})();

function crc(pagina: Uint8Array): number {
  let r = 0;
  for (const byte of pagina) r = ((r << 8) ^ TABLA_CRC[((r >>> 24) ^ byte) & 0xff]) >>> 0;
  return r;
}

const esSilencio = (p: Uint8Array) => p.length === 3 && p.every((b, i) => b === SILENCIO[i]);

/** Mismo formato que el trabajador de medios para audio: [1 byte en claro][cifrado][IV]. */
async function descifrarPaquete(p: Uint8Array<ArrayBuffer>, clave: CryptoKey): Promise<Uint8Array<ArrayBuffer>> {
  if (esSilencio(p) || p.length < 1 + 16 + 12) return p;
  try {
    const claro = await crypto.subtle.decrypt({ name: "AES-GCM", iv: p.subarray(p.length - 12), additionalData: p.subarray(0, 1) }, clave, p.subarray(1, p.length - 12));
    const salida = new Uint8Array(1 + claro.byteLength);
    salida[0] = p[0];
    salida.set(new Uint8Array(claro), 1);
    return salida;
  } catch {
    return new Uint8Array(SILENCIO);
  }
}

function armarPagina(cabecera: Uint8Array, paquetes: Uint8Array[]): Uint8Array {
  const lacing: number[] = [];
  for (const p of paquetes) {
    for (let resto = p.length; ; resto -= 255) {
      lacing.push(Math.min(resto, 255));
      if (resto < 255) break;
    }
  }
  const datos = paquetes.reduce((suma, p) => suma + p.length, 0);
  const pagina = new Uint8Array(27 + lacing.length + datos);
  pagina.set(cabecera.subarray(0, 26));
  pagina[26] = lacing.length;
  pagina.set(lacing, 27);
  let pos = 27 + lacing.length;
  for (const p of paquetes) {
    pagina.set(p, pos);
    pos += p.length;
  }
  pagina.fill(0, 22, 26);
  new DataView(pagina.buffer).setUint32(22, crc(pagina), true);
  return pagina;
}

export async function descifrarOgg(ogg: Uint8Array<ArrayBuffer>, clave: CryptoKey): Promise<ArrayBuffer> {
  const paginas: Uint8Array[] = [];
  let pos = 0;
  for (let indice = 0; pos + 27 <= ogg.length; indice++) {
    const segmentos = ogg[pos + 26];
    const lacing = ogg.subarray(pos + 27, pos + 27 + segmentos);
    const largo = 27 + segmentos + lacing.reduce((a, b) => a + b, 0);
    const pagina = ogg.subarray(pos, pos + largo);
    pos += largo;
    // Las dos primeras páginas son las cabeceras Opus; una página con un paquete partido se deja igual
    if (indice < 2 || lacing[lacing.length - 1] === 255) {
      paginas.push(pagina);
      continue;
    }
    const paquetes: Uint8Array<ArrayBuffer>[] = [];
    let inicio = 27 + segmentos;
    let tamano = 0;
    for (const l of lacing) {
      tamano += l;
      if (l < 255) {
        paquetes.push(await descifrarPaquete(pagina.slice(inicio, inicio + tamano), clave));
        inicio += tamano;
        tamano = 0;
      }
    }
    paginas.push(armarPagina(pagina, paquetes));
  }
  const total = new Uint8Array(paginas.reduce((a, p) => a + p.length, 0));
  let escrito = 0;
  for (const p of paginas) {
    total.set(p, escrito);
    escrito += p.length;
  }
  return total.buffer;
}
