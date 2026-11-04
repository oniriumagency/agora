// Arranca a la vez el servidor de señalización (puerto 8180) y la web en modo desarrollo (3100).
import { spawn } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const procesos = [
  spawn(process.execPath, ["servidor/src/servidor.ts"], { stdio: "inherit" }),
  spawn(npm, ["run", "dev:web"], { stdio: "inherit", shell: process.platform === "win32" }),
];
const terminar = () => procesos.forEach((proceso) => proceso.kill());
for (const proceso of procesos) proceso.on("exit", (codigo) => { terminar(); process.exit(codigo ?? 0); });
process.on("SIGINT", terminar);
process.on("SIGTERM", terminar);
