import { cifrarBytes, cifrarTexto, descifrarBytes } from "@/cifrado/claves";
import { urlServidor } from "./urlSenalizacion";

/**
 * Sube un archivo al servidor de la reunión; el servidor lo reparte en el chat a todos. Antes se
 * cifra en el navegador (contenido, nombre y tipo): el servidor guarda bytes que no puede leer.
 */
export function subirArchivo(
  archivo: File,
  clave: string,
  alProgresar: (fraccion: number) => void,
): { promesa: Promise<void>; cancelar: () => void } {
  const peticion = new XMLHttpRequest();
  let cancelado = false;
  const promesa = Promise.all([archivo.arrayBuffer().then((bytes) => cifrarBytes(bytes)), cifrarTexto(JSON.stringify({ n: archivo.name, t: archivo.type }))]).then(
    ([cuerpo, nombre]) => enviar(peticion, cuerpo, nombre, clave, alProgresar, () => cancelado),
  );
  return {
    promesa,
    cancelar: () => {
      cancelado = true;
      peticion.abort();
    },
  };
}

function enviar(peticion: XMLHttpRequest, cuerpo: Uint8Array<ArrayBuffer>, nombre: string, clave: string, alProgresar: (fraccion: number) => void, cancelado: () => boolean): Promise<void> {
  return new Promise<void>((resolver, rechazar) => {
    if (cancelado()) return rechazar(new Error("Cancelado"));
    peticion.open("POST", `${urlServidor()}/archivos?nombre=${encodeURIComponent(nombre)}`);
    peticion.setRequestHeader("X-Clave", clave);
    peticion.upload.onprogress = (evento) => {
      if (evento.lengthComputable) alProgresar(evento.loaded / evento.total);
    };
    peticion.onload = () => {
      if (peticion.status >= 200 && peticion.status < 300) resolver();
      else rechazar(new Error(peticion.responseText.trim() || `Error ${peticion.status}`));
    };
    peticion.onerror = () => rechazar(new Error("Se cortó la conexión al enviar el archivo."));
    peticion.onabort = () => rechazar(new Error("Cancelado"));
    peticion.send(new Blob([cuerpo], { type: "application/octet-stream" }));
  });
}

/** Descarga un archivo (o un audio de reconexión) del servidor y lo descifra. */
export async function obtenerArchivo(id: string, tipo: string): Promise<Blob> {
  const respuesta = await fetch(urlArchivo(id), { cache: "no-store" });
  if (!respuesta.ok) throw new Error("El archivo ya no está disponible.");
  return new Blob([await descifrarBytes(await respuesta.arrayBuffer())], { type: tipo });
}

function urlArchivo(id: string): string {
  return `${urlServidor()}/archivos/${encodeURIComponent(id)}`;
}

/** Igual que en Kubox: tamaño legible. */
export function formatearBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  if (bytes >= 1024) return Math.round(bytes / 1024) + " KB";
  return bytes + " B";
}
