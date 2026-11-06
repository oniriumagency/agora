// Compila la web (exportación estática), la copia dentro del servidor Go y genera los ejecutables:
//   dist/AgoraServidor.exe            (Windows)
//   dist/agora-servidor-linux          (Ubuntu u otro Linux x64)
//   dist/agora-ubuntu.tar.gz           (servidor Linux + instalador para Ubuntu)
// Requiere Go 1.21+ (https://go.dev/dl/; descarga sola la versión del proyecto). Uso: npm run exe  [-- --solo-windows]
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");
const web = path.join(raiz, "servidor-go", "web");
const dist = path.join(raiz, "dist");
// En Windows npx es un .cmd y necesita shell; go no, y con shell se partiría "-s -w" en dos argumentos.
const ejecutar = (orden, args, opciones = {}) => execFileSync(orden, args, { stdio: "inherit", shell: process.platform === "win32" && orden === "npx", ...opciones });

console.log("== Web (next build)");
ejecutar("npx", ["next", "build"], { cwd: raiz });

console.log("== Copiando la web dentro del servidor");
for (const entrada of readdirSync(web)) if (entrada !== "LEEME.txt") rmSync(path.join(web, entrada), { recursive: true, force: true });
cpSync(path.join(raiz, "out"), web, { recursive: true });

mkdirSync(dist, { recursive: true });
const objetivos = [
  { GOOS: "windows", GOARCH: "amd64", salida: "AgoraServidor.exe" },
  { GOOS: "linux", GOARCH: "amd64", salida: "agora-servidor-linux" },
].filter((objetivo) => !process.argv.includes("--solo-windows") || objetivo.GOOS === "windows");
for (const { GOOS, GOARCH, salida } of objetivos) {
  console.log(`== Servidor ${GOOS}/${GOARCH}`);
  ejecutar("go", ["build", "-trimpath", "-ldflags", "-s -w", "-o", path.join(dist, salida), "."], {
    cwd: path.join(raiz, "servidor-go"),
    env: { ...process.env, GOOS, GOARCH, CGO_ENABLED: "0" },
  });
}
if (objetivos.some((objetivo) => objetivo.GOOS === "linux")) {
  console.log("== Paquete para Ubuntu");
  const paquete = path.join(dist, "agora");
  rmSync(paquete, { recursive: true, force: true });
  mkdirSync(paquete);
  cpSync(path.join(dist, "agora-servidor-linux"), path.join(paquete, "agora-servidor-linux"));
  for (const archivo of ["instalar.sh", "actualizar.sh", "permitir-actualizaciones.sh", "agora.service", "agora.env.example", "LEEME.md"]) {
    cpSync(path.join(raiz, "despliegue", "ubuntu", archivo), path.join(paquete, archivo));
  }
  // tar viene con Windows 10+ y con Linux; se ejecuta sin shell para no depender de comillas.
  execFileSync("tar", ["-czf", "agora-ubuntu.tar.gz", "agora"], { cwd: dist, stdio: "inherit" });
  rmSync(paquete, { recursive: true, force: true });
}
console.log(`Listo: ${dist}`);
