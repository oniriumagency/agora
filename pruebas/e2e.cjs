// Prueba de extremo a extremo con dos navegadores Chromium y cámara/micrófono simulados.
// Requiere el servidor en marcha (npm run dev o el .exe; por defecto http://localhost:8090), y Playwright instalado (npx playwright install chromium).
//   node pruebas/e2e.cjs [http://localhost:8090] [carpeta-capturas]
const { chromium } = require("playwright");

const BASE = process.argv[2] ?? "http://localhost:8090";
const CAPTURAS = process.argv[3] ?? null;
const SALA = `prueba-${Math.random().toString(36).slice(2, 8)}`;

function comprobar(condicion, mensaje) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`  ok  ${mensaje}`);
}

async function entrar(navegador, nombre) {
  const contexto = await navegador.newContext({ permissions: ["camera", "microphone"], viewport: { width: 1280, height: 760 } });
  const pagina = await contexto.newPage();
  if (process.env.DEPURAR) pagina.on("websocket", (ws) => { ws.on("framereceived", (f) => console.log(`[${nombre}] <-`, String(f.payload).slice(0, 90))); ws.on("framesent", (f) => console.log(`[${nombre}] ->`, String(f.payload).slice(0, 90))); });
  pagina.on("console", (m) => m.type() === "error" && console.error(`[${nombre}] consola:`, m.text().slice(0, 400)));
  pagina.on("pageerror", (error) => console.error(`[${nombre}] error de página:`, error.message));
  await pagina.goto(`${BASE}/${SALA}`);
  await pagina.getByLabel("Tu nombre").fill(nombre);
  await pagina.waitForSelector("video");
  await pagina.getByRole("button", { name: "Unirse ahora" }).click();
  await pagina.getByLabel("Salir de la llamada").waitFor();
  return pagina;
}

/** ¿El vídeo de esa tesela recibe fotogramas? */
async function videoVivo(pagina, textoEtiqueta) {
  return pagina.waitForFunction(
    (texto) => [...document.querySelectorAll("[data-tesela]")].some((tesela) => tesela.textContent.includes(texto) && tesela.querySelector("video")?.videoWidth > 0),
    textoEtiqueta,
    { timeout: 15000 }
  ).then(() => true, () => false);
}

(async () => {
  const navegador = await chromium.launch({
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--auto-select-desktop-capture-source=Entire screen", "--autoplay-policy=no-user-gesture-required"],
  });
  try {
    console.log(`Sala ${SALA}`);
    const ana = await entrar(navegador, "Ana");
    const beto = await entrar(navegador, "Beto");
    comprobar(await videoVivo(beto, "Ana"), "Beto recibe el vídeo de Ana");
    comprobar(await videoVivo(ana, "Beto"), "Ana recibe el vídeo de Beto");

    await ana.keyboard.press("Control+d");
    await beto.locator('[data-tesela$=":camara"]', { hasText: "Ana" }).locator('[title="Micrófono desactivado"]').waitFor();
    comprobar(true, "Beto ve el micrófono de Ana desactivado");

    await ana.getByLabel(/Levantar la mano/).click();
    await beto.getByText("Ana levantó la mano").waitFor();
    comprobar(true, "Beto recibe el aviso de la mano levantada");

    await ana.getByLabel("Chat con todos").click();
    await ana.getByLabel("Escribe un mensaje para todos").fill("Hola, ¿me escuchan? https://example.com");
    await ana.keyboard.press("Enter");
    await beto.getByLabel("Chat con todos").click();
    await beto.getByRole("log").getByText("Hola, ¿me escuchan?").waitFor();
    comprobar(true, "Beto recibe el mensaje de chat");

    await beto.getByLabel("Enviar una reacción").click();
    await beto.getByLabel("Reaccionar con 🎉").click();
    await ana.locator(".animate-subir", { hasText: "🎉" }).first().waitFor({ state: "attached" });
    comprobar(true, "Ana ve la reacción de Beto");

    await ana.getByLabel("Presentar pantalla").click();
    comprobar(await videoVivo(beto, "Presentación de Ana"), "Beto ve la pantalla que presenta Ana");

    if (CAPTURAS) {
      await beto.waitForTimeout(800);
      await beto.screenshot({ path: `${CAPTURAS}/beto-presentacion.png` });
      await ana.screenshot({ path: `${CAPTURAS}/ana-presentando.png` });
    }
    await ana.getByLabel("Dejar de presentar").first().click();
    await ana.getByLabel("Salir de la llamada").click();
    await beto.getByText("Ana salió de la reunión").waitFor();
    comprobar(true, "Beto ve que Ana salió");
    console.log("Todas las comprobaciones pasaron.");
  } finally {
    await navegador.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
