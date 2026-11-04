import { urlServidor } from "./urlSenalizacion";

/** Sube un archivo al servidor de la reunión; el servidor lo reparte en el chat a todos. */
export function subirArchivo(
  archivo: File,
  clave: string,
  alProgresar: (fraccion: number) => void,
): { promesa: Promise<void>; cancelar: () => void } {
  const peticion = new XMLHttpRequest();
  const promesa = new Promise<void>((resolver, rechazar) => {
    peticion.open("POST", `${urlServidor()}/archivos?nombre=${encodeURIComponent(archivo.name)}`);
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
    peticion.send(archivo);
  });
  return { promesa, cancelar: () => peticion.abort() };
}

export function urlArchivo(id: string, ver = false): string {
  return `${urlServidor()}/archivos/${encodeURIComponent(id)}${ver ? "?ver=1" : ""}`;
}

/** Igual que en Kubox: tamaño legible. */
export function formatearBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  if (bytes >= 1024) return Math.round(bytes / 1024) + " KB";
  return bytes + " B";
}
