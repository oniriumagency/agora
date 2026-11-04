// Reunión grande a través del SFU: N participantes con cámara simulada. Comprueba que el primero
// ve vídeo en la página 1, que al pasar de página ve a otros (cambio de ranuras sin renegociar) y
// que recibe audio.   node pruebas/e2e-grande.cjs [http://localhost:8090] [N=12] [carpeta-capturas]
const { chromium } = require("playwright");

const BASE = process.argv[2] ?? "http://localhost:8090";
const N = Number(process.argv[3] ?? 12);
const CAPTURAS = process.argv[4] ?? null;
const SALA = `grande-${Math.random().toString(36).slice(2, 7)}`;

const comprobar = (condicion, mensaje) => {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`  ok  ${mensaje}`);
};

const videosVivos = (pagina) =>
  pagina.evaluate(() => [...document.querySelectorAll("[data-tesela$=':camara'] video")].filter((v) => v.videoWidth > 0 && !v.closest("[data-tesela]").textContent.includes("(Tú)")).map((v) => v.closest("[data-tesela]").textContent));

(async () => {
  const navegador = await chromium.launch({ args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
  try {
    const paginas = [];
    for (let i = 0; i < N; i++) {
      const contexto = await navegador.newContext({ permissions: ["camera", "microphone"], viewport: { width: 1280, height: 760 } });
      const pagina = await contexto.newPage();
      await pagina.goto(`${BASE}/${SALA}#clave-de-la-prueba-grande`);
      await pagina.getByLabel("Tu nombre").fill(`Persona ${String(i + 1).padStart(2, "0")}`);
      await pagina.getByRole("button", { name: "Unirse ahora" }).click();
      await pagina.getByLabel("Salir de la llamada").waitFor();
      paginas.push(pagina);
    }
    const primera = paginas[0];
    await primera.waitForFunction((n) => document.querySelectorAll("[data-tesela]").length >= Math.min(n, 9), N, { timeout: 20000 });
    await primera.waitForTimeout(6000);
    const pagina1 = await videosVivos(primera);
    console.log("  página 1:", pagina1.join(" | "));
    comprobar(pagina1.length >= Math.min(N - 1, 8) - 1, `ve ${pagina1.length} vídeos en la primera página`);
    if (CAPTURAS) await primera.screenshot({ path: `${CAPTURAS}/grande-p1.png` });

    if (N > 9) {
      await primera.getByLabel("Página siguiente").click();
      await primera.waitForTimeout(5000);
      const pagina2 = await videosVivos(primera);
      console.log("  página 2:", pagina2.join(" | "));
      comprobar(pagina2.length >= Math.min(N - 9, 8) && pagina2.every((t) => !pagina1.includes(t)), `ve ${pagina2.length} vídeos distintos en la segunda página`);
      if (CAPTURAS) await primera.screenshot({ path: `${CAPTURAS}/grande-p2.png` });
    }
    const audio = await primera.evaluate(() => [...document.querySelectorAll("audio")].filter((a) => a.srcObject && a.srcObject.getAudioTracks()[0]?.readyState === "live").length);
    comprobar(audio === N - 1, `recibe ${audio} pistas de audio (una por persona)`);
    console.log("Reunión grande correcta.");
  } finally {
    await navegador.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
