Primera versión pública de **Ágora**: videollamadas en tu propio servidor, cifradas de extremo a extremo y sin cuentas.

## Descargas

| Archivo | Para qué |
|---|---|
| `AgoraServidor.exe` | Windows 10/11 (x64). Ábrelo con doble clic: prepara el firewall, intenta abrir el router y te da un enlace público con HTTPS. |
| `agora-servidor-linux` | Linux x64. Ejecutable suelto (`./agora-servidor-linux --help`). |
| `agora-ubuntu.tar.gz` | Servidor de Linux con instalador como servicio systemd. Guía: [despliegue/ubuntu/LEEME.md](https://github.com/oniriumagency/agora/blob/main/despliegue/ubuntu/LEEME.md). |
| `SHA256SUMS.txt` | Sumas de comprobación. |

Windows puede avisar con SmartScreen la primera vez porque el ejecutable no está firmado: «Más información» > «Ejecutar de todas formas».

## Qué incluye

- Cámara, micrófono y pantalla compartida; chat con archivos (hasta 95 MB), mano alzada y reacciones.
- Cifrado de extremo a extremo (AES-GCM 256) de audio, vídeo, chat, nombres y archivos: la clave viaja tras el `#` del enlace y nunca llega al servidor.
- SFU propio en Go + Pion con simulcast en tres calidades, control de congestión (transport-cc/GCC) y Opus con DTX.
- Mosaico paginado para reuniones grandes (hasta 100 personas por sala), modo bolsillo en el móvil y app instalable (PWA).
- Anfitrión: silenciar y expulsar.

Licencia AGPL-3.0.
