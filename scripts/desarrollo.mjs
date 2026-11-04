// Desarrollo: servidor Go (puerto 8090, sin túnel ni UPnP) y web con recarga en caliente (3100).
import { spawn } from "node:child_process";

const shell = process.platform === "win32";
const procesos = [
  spawn("go", ["run", ".", "--sin-tunel", "--sin-upnp", "--sin-firewall", "--sin-navegador"], { cwd: "servidor-go", stdio: "inherit", shell }),
  spawn("npm", ["run", "dev:web"], { stdio: "inherit", shell }),
];
const terminar = () => procesos.forEach((proceso) => proceso.kill());
for (const proceso of procesos) proceso.on("exit", (codigo) => { terminar(); process.exit(codigo ?? 0); });
process.on("SIGINT", terminar);
process.on("SIGTERM", terminar);
