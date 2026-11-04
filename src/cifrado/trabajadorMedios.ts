/**
 * Trabajador que cifra y descifra cada fotograma de audio y vídeo (cifrado de extremo a extremo).
 *
 * El servidor de Ágora solo reenvía los paquetes; para elegir dónde empieza un fotograma clave VP8
 * mira la cabecera, así que sus primeros bytes viajan en claro (10 en fotogramas clave, 3 en los
 * demás y 1 en audio, como hace Jitsi) y quedan autenticados como datos adicionales de AES-GCM.
 * Formato: [cabecera en claro][cifrado + etiqueta][IV de 12 bytes].
 *
 * Acepta las dos API de los navegadores: RTCRtpScriptTransform (Safari, Firefox y Chrome
 * recientes) y createEncodedStreams (Chrome), que llega como un par de flujos por mensaje.
 */
type Lado = "enviar" | "recibir";
type Clase = "audio" | "video";
interface Fotograma {
  data: ArrayBuffer;
  type?: "key" | "delta" | "empty";
}

let clave: CryptoKey | null = null;

function enClaro(fotograma: Fotograma, clase: Clase): number {
  if (clase === "audio") return 1;
  return fotograma.type === "key" ? 10 : 3;
}

async function cifrar(fotograma: Fotograma, clase: Clase): Promise<boolean> {
  if (!clave) return false; // sin clave no sale nada: nunca se envía en claro
  const datos = new Uint8Array(fotograma.data);
  const n = Math.min(enClaro(fotograma, clase), datos.length);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: datos.subarray(0, n) }, clave, datos.subarray(n)));
  const salida = new Uint8Array(n + cifrado.length + 12);
  salida.set(datos.subarray(0, n));
  salida.set(cifrado, n);
  salida.set(iv, n + cifrado.length);
  fotograma.data = salida.buffer;
  return true;
}

async function descifrar(fotograma: Fotograma, clase: Clase): Promise<boolean> {
  if (!clave) return false;
  const datos = new Uint8Array(fotograma.data);
  const n = enClaro(fotograma, clase);
  if (datos.length < n + 16 + 12) return false;
  try {
    const claro = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: datos.subarray(datos.length - 12), additionalData: datos.subarray(0, n) },
      clave,
      datos.subarray(n, datos.length - 12),
    );
    const salida = new Uint8Array(n + claro.byteLength);
    salida.set(datos.subarray(0, n));
    salida.set(new Uint8Array(claro), n);
    fotograma.data = salida.buffer;
    return true;
  } catch {
    return false; // otra clave o manipulado: se descarta
  }
}

function conectar(readable: ReadableStream<Fotograma>, writable: WritableStream<Fotograma>, lado: Lado, clase: Clase): void {
  const operar = lado === "enviar" ? cifrar : descifrar;
  void readable
    .pipeThrough(
      new TransformStream<Fotograma, Fotograma>({
        async transform(fotograma, control) {
          if (fotograma.data.byteLength === 0 || (await operar(fotograma, clase))) control.enqueue(fotograma);
        },
      }),
    )
    .pipeTo(writable)
    .catch(() => undefined);
}

interface MensajeTrabajador {
  tipo: "clave" | "flujos";
  bytes: ArrayBuffer;
  readable: ReadableStream<Fotograma>;
  writable: WritableStream<Fotograma>;
  lado: Lado;
  clase: Clase;
}

const ambito = self as unknown as {
  onmessage: (evento: { data: MensajeTrabajador }) => void;
  onrtctransform: (evento: { transformer: { readable: ReadableStream<Fotograma>; writable: WritableStream<Fotograma>; options: { lado: Lado; clase: Clase } } }) => void;
};

ambito.onrtctransform = ({ transformer }) => conectar(transformer.readable, transformer.writable, transformer.options.lado, transformer.options.clase);

ambito.onmessage = async ({ data }) => {
  if (data.tipo === "clave") clave = await crypto.subtle.importKey("raw", data.bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
  else if (data.tipo === "flujos") conectar(data.readable, data.writable, data.lado, data.clase);
};
