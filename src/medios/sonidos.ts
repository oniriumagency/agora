/**
 * Avisos sonoros de la reunión: una cuerda de arpa pulsada, sintetizada en el navegador con el
 * algoritmo de Karplus-Strong (ruido que recorre una línea de retardo con un filtro suave). Dos
 * notas ascendentes y agudas cuando alguien entra; dos descendentes y graves cuando alguien sale.
 */
let contexto: AudioContext | null = null;
const cuerdas = new Map<number, AudioBuffer>();

const CLAVE_SONIDOS = "agora.sonidos";

export function sonidosActivados(): boolean {
  try {
    return localStorage.getItem(CLAVE_SONIDOS) !== "no";
  } catch {
    return true;
  }
}

export function fijarSonidos(activos: boolean): void {
  try {
    localStorage.setItem(CLAVE_SONIDOS, activos ? "si" : "no");
  } catch {
    /* sin almacenamiento: solo dura esta sesión */
  }
}

/** Hay que llamarla durante un toque o clic (p. ej. "Unirse ahora"): los navegadores exigen un gesto para sonar. */
export function prepararSonidos(): void {
  try {
    contexto ??= new AudioContext();
    void contexto.resume();
  } catch {
    contexto = null;
  }
}

function cuerda(ctx: AudioContext, frecuencia: number): AudioBuffer {
  const guardada = cuerdas.get(frecuencia);
  if (guardada) return guardada;
  const tasa = ctx.sampleRate;
  const duracion = 1.8;
  const buffer = ctx.createBuffer(1, Math.floor(tasa * duracion), tasa);
  const datos = buffer.getChannelData(0);
  const periodo = Math.max(2, Math.round(tasa / frecuencia));
  // Excitación: ruido ya suavizado, como un dedo (no una púa) que pulsa la cuerda
  let previo = 0;
  for (let i = 0; i < periodo; i++) {
    previo = previo * 0.55 + (Math.random() * 2 - 1) * 0.45;
    datos[i] = previo;
  }
  // Las cuerdas graves del arpa suenan más tiempo que las agudas
  const amortiguacion = frecuencia > 500 ? 0.9955 : 0.9985;
  for (let i = periodo; i < datos.length; i++) {
    datos[i] = amortiguacion * 0.5 * (datos[i - periodo] + datos[Math.max(0, i - periodo - 1)]);
  }
  // Normalizar y apagar el final sin chasquido
  let maximo = 0;
  for (const muestra of datos) maximo = Math.max(maximo, Math.abs(muestra));
  const final = Math.floor(tasa * 0.3);
  for (let i = 0; i < datos.length; i++) {
    const cola = i > datos.length - final ? (datos.length - i) / final : 1;
    datos[i] = (datos[i] / (maximo || 1)) * cola;
  }
  cuerdas.set(frecuencia, buffer);
  return buffer;
}

function pulsar(frecuencias: number[], volumen: number): void {
  if (!contexto || !sonidosActivados()) return;
  const ctx = contexto;
  if (ctx.state !== "running") void ctx.resume();
  const salida = ctx.createGain();
  salida.gain.value = volumen;
  // Un poco de cuerpo de madera: realza los medios y quita aspereza
  const cuerpo = ctx.createBiquadFilter();
  cuerpo.type = "lowpass";
  cuerpo.frequency.value = 3800;
  cuerpo.connect(salida).connect(ctx.destination);
  frecuencias.forEach((frecuencia, indice) => {
    const fuente = ctx.createBufferSource();
    fuente.buffer = cuerda(ctx, frecuencia);
    fuente.connect(cuerpo);
    fuente.start(ctx.currentTime + 0.02 + indice * 0.085);
  });
}

/** Alguien entró: mi y si agudos (E5, B5). */
export const sonarEntrada = () => pulsar([659.25, 987.77], 0.32);
/** Alguien salió: la y mi graves (A3, E3). */
export const sonarSalida = () => pulsar([220, 164.81], 0.42);
