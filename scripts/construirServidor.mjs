// Compila la web (exportación estática), la copia dentro del servidor Go y genera los ejecutables:
//   dist/KuboxMeetServidor.exe        (Windows)
//   dist/kubox-meet-servidor-linux    (Ubuntu u otro Linux x64)
// Requiere Go 1.21+ (https://go.dev/dl/; descarga sola la versión del proyecto). Uso: npm run exe  [-- --solo-windows]
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");
const web = path.join(raiz, "servidor-go", "web");
const dist = path.join(raiz, "dist");
const ejecutar = (orden, args, opciones = {}) => execFileSync(orden, args, { stdio: "inherit", shell: process.platform === "win32", ...opciones });

console.log("== Web (next build)");
ejecutar("npx", ["next", "build"], { cwd: raiz });

console.log("== Copiando la web dentro del servidor");
for (const entrada of readdirSync(web)) if (entrada !== "LEEME.txt") rmSync(path.join(web, entrada), { recursive: true, force: true });
cpSync(path.join(raiz, "out"), web, { recursive: true });

mkdirSync(dist, { recursive: true });
const objetivos = [
  { GOOS: "windows", GOARCH: "amd64", salida: "KuboxMeetServidor.exe" },
  { GOOS: "linux", GOARCH: "amd64", salida: "kubox-meet-servidor-linux" },
].filter((objetivo) => !process.argv.includes("--solo-windows") || objetivo.GOOS === "windows");
for (const { GOOS, GOARCH, salida } of objetivos) {
  console.log(`== Servidor ${GOOS}/${GOARCH}`);
  ejecutar("go", ["build", "-trimpath", "-ldflags", "-s -w", "-o", path.join(dist, salida), "."], {
    cwd: path.join(raiz, "servidor-go"),
    env: { ...process.env, GOOS, GOARCH, CGO_ENABLED: "0" },
  });
}
console.log(`Listo: ${dist}`);
