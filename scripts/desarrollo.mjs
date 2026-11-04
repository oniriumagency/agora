// Desarrollo: servidor Go (puerto 8090, sin túnel ni UPnP) y web con recarga en caliente (3100).
// El servidor se compila siempre en la misma ruta (dist/): con "go run" el ejecutable cambia de
// carpeta en cada arranque y el Firewall de Windows vuelve a pedir permiso cada vez.
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

const windows = process.platform === "win32";
const raiz = path.resolve(import.meta.dirname, "..");
const servidor = path.join(raiz, "dist", windows ? "agora-desarrollo.exe" : "agora-desarrollo");
mkdirSync(path.dirname(servidor), { recursive: true });
execFileSync("go", ["build", "-o", servidor, "."], { cwd: path.join(raiz, "servidor-go"), stdio: "inherit" });

const procesos = [
  spawn(servidor, ["--sin-tunel", "--sin-upnp", "--sin-firewall", "--sin-navegador"], { cwd: path.join(raiz, "servidor-go"), stdio: "inherit" }),
  spawn("npm", ["run", "dev:web"], { cwd: raiz, stdio: "inherit", shell: windows }),
];
const terminar = () => procesos.forEach((proceso) => proceso.kill());
for (const proceso of procesos) proceso.on("exit", (codigo) => { terminar(); process.exit(codigo ?? 0); });
process.on("SIGINT", terminar);
process.on("SIGTERM", terminar);
