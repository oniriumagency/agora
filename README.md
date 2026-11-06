# Ágora

Reuniones por vídeo al estilo Google Meet con **servidor propio**: cualquiera abre
`AgoraServidor.exe` en su PC, el programa prepara la red y muestra el enlace que hay que
compartir. Cámara y micrófono, chat, mano alzada, reacciones, pantalla compartida y reuniones grandes.

Página del proyecto: [oniriumagency.github.io/agora](https://oniriumagency.github.io/agora/) (código en `sitio/`).

## Funciones

- Cámara, micrófono y pantalla compartida, con selector de dispositivos y vista previa antes de entrar.
- Chat con enlaces y archivos (hasta 95 MB), mano alzada y reacciones flotantes.
- Mosaico paginado para reuniones grandes, vista de una sola persona y pantalla completa.
- Anfitrión: silenciar y expulsar.
- Celular: modo bolsillo, sigue la llamada con la pantalla bloqueada y recupera el sitio tras un corte.
- Instalable como app (PWA) y sin cuentas: basta con compartir el enlace de la sala.
- **Cifrado de extremo a extremo** de audio, vídeo, chat, archivos y nombres (ver abajo).

## Seguridad y privacidad

Cada reunión tiene una **clave secreta** que viaja en el enlace tras el `#`
(`https://…/abc-defg-hij#clave`). Los navegadores nunca envían esa parte al servidor. Al abrir el
enlace, la clave se guarda solo en esa pestaña; la dirección del navegador la conserva para que
copiarla sirva para invitar. Quien crea la
reunión también puede elegir una contraseña propia (mínimo 8 caracteres) y dictarla junto al código.

De la clave se derivan, en el navegador (PBKDF2 con 210 000 iteraciones y HKDF, sal = código de sala):

| Clave | Para qué |
|---|---|
| Medios (AES-GCM 256) | Cada fotograma de audio y vídeo, con WebRTC Encoded Transform. Solo quedan en claro los primeros bytes de cada fotograma (1 en audio, 3 o 10 en vídeo) para que el servidor sepa dónde empieza un fotograma clave. |
| Datos (AES-GCM 256) | Chat, nombres de las personas, archivos (contenido, nombre y tipo). |
| Acceso | Una huella que el servidor compara para dejar entrar. No sirve para descifrar nada. |

Qué ve cada parte:

- **El servidor** (y quien lo administre): quién se conecta (IP), cuándo, cuántas personas hay, el
  tamaño de los archivos y el estado de micrófono, cámara y mano alzada. No ve ni oye el contenido.
- **Cloudflare** (túnel y TURN): lo mismo que el servidor como mucho. El HTTPS termina en su red,
  pero lo que pasa por ahí ya va cifrado de extremo a extremo.
- **Quien tenga el enlace completo** puede entrar y descifrar: compártelo solo por un canal de confianza.

Además: los códigos de reunión tienen al menos 10 letras, el servidor espera un segundo antes de
responder a una clave incorrecta, la señalización solo acepta conexiones desde la propia web, el
registro no guarda nombres ni nombres de archivo, y la web se sirve con cabeceras que impiden
incrustarla en otras páginas. El cifrado de medios necesita un navegador actual (Chrome, Edge,
Firefox o Safari recientes).

## Cómo se usa

1. Abre `AgoraServidor.exe` (doble clic). Al arrancar:
   - Pide permiso de administrador una vez para crear la regla del **Firewall de Windows**.
   - Intenta abrir el puerto de vídeo en el **router** (UPnP o NAT-PMP) y avisa si no puede o si
     hay **CGNAT** (entonces desde Internet hace falta TURN, ver abajo).
   - Abre un **enlace público HTTPS** con un túnel rápido de Cloudflare (gratis, sin cuenta; la
     primera vez descarga `cloudflared`).
   - Muestra los enlaces y abre el navegador.
2. Pulsa **Nueva reunión** y comparte el enlace que copia el botón (lleva la clave tras el `#`).
   El servidor está en `https://….trycloudflare.com`. En tu misma red también vale
   `https://<tu IP local>:8443` (el navegador avisará del certificado la primera vez).
3. Deja la ventana abierta mientras dure la reunión.

```
  ✔ Firewall de Windows: permitido
  ✔ Router: puertos 8091 UDP/TCP abiertos con UPnP (IP pública 203.0.113.5)
  ! TURN: sin configurar (opcional si los puertos están abiertos)

  Comparte este enlace para entrar desde cualquier sitio:
    https://palabras-al-azar.trycloudflare.com
```

### Si hay CGNAT (o el router no abre puertos)

Crea `agora.env` junto al `.exe` con tu clave TURN de Cloudflare Realtime (plantilla en `despliegue/ubuntu/agora.env.example`):

```
MEET_TURN_CLOUDFLARE_ID=...
MEET_TURN_CLOUDFLARE_TOKEN=...
```

Así el vídeo pasa por el relé de Cloudflare cuando no hay conexión directa. Cloudflare cobra ese
tráfico por encima de su cuota gratuita.

## Arquitectura

- **Servidor** (`servidor-go/`, Go + [Pion](https://github.com/pion/webrtc)): un solo ejecutable
  con la web incluida, la señalización (`/senal`, WebSocket) y un **SFU**. Cada persona envía su
  audio y vídeo una sola vez al servidor y este lo reenvía a las demás.
- **Ranuras**: cada persona recibe el vídeo por un número fijo de transceptores. Al pasar de página
  el servidor cambia qué vídeo va en cada ranura (reescribiendo secuencia y tiempos RTP) sin
  renegociar. Solo se descarga el vídeo de quien se ve en pantalla (`MEET_MAXIMO_VIDEOS`, 9 por
  defecto); el audio llega de todos.
- **Simulcast**: cada cámara envía tres calidades (320, 640 y 1280 px de ancho; unos 150, 500 y
  1500 kbps). El servidor mide con transport-cc y GCC el ancho de banda hacia cada persona y le
  reenvía la calidad que le cabe: la alta solo con una o dos cámaras en pantalla, y baja enseguida si
  aparece congestión. A quien publica se le pide que no envíe calidades que nadie está viendo.
- **Audio**: Opus con corrección de errores en banda y DTX (casi no gasta mientras alguien calla).
  Los navegadores ajustan su envío con transport-cc. El servidor no guarda audio ni vídeo.
- **Un puerto de medios** (8091 UDP y TCP) para todas las conexiones; TCP sirve en redes que
  bloquean UDP.
- **Web** (`src/`, Next.js 14 + TypeScript + Tailwind) exportada como archivos estáticos.

### ¿Cuánta gente cabe?

El límite real es la **subida** de quien aloja: cada persona que mira recibe hasta 9 vídeos
(unos 500 kbps cada uno con tres o más en pantalla, o menos si su conexión no da para más) y
el audio de todos. Calcula aproximadamente 2 o 3 Mbps de subida por participante con vídeo:

| Subida del servidor | Personas con vídeo cómodas |
| :--- | :--- |
| 20 Mbps | 8 a 10 |
| 100 Mbps | 35 a 50 |
| 600 Mbps (fibra simétrica) | 100 o más |

Con mucha gente, quien no se ve en la página actual no consume nada de vídeo.

## Configuración

Cada opción se puede pasar como argumento o como variable de entorno (también desde `agora.env`
junto al ejecutable). Plantilla completa en [`despliegue/ubuntu/agora.env.example`](despliegue/ubuntu/agora.env.example).

| Variable | Argumento | Por defecto | Para qué |
|---|---|---|---|
| `MEET_PUERTO_WEB` | `--puerto-web` | 8090 | Web y señalización (HTTP) |
| `MEET_PUERTO_HTTPS` | `--puerto-https` | 8443 | HTTPS con certificado propio para la red local (0 lo apaga) |
| `MEET_PUERTO_MEDIOS` | `--puerto-medios` | 8091 | Audio y vídeo (UDP y TCP) |
| `MEET_MAXIMO_POR_SALA` | `--maximo-por-sala` | 100 | Personas por reunión |
| `MEET_MAXIMO_VIDEOS` | `--maximo-videos` | 9 | Vídeos que recibe cada persona a la vez |
| `MEET_MAXIMO_SALAS` | `--maximo-salas` | 50 | Reuniones simultáneas |
| `MEET_MAXIMO_CONEXIONES` | `--maximo-conexiones` | 500 | Conexiones simultáneas |
| `MEET_MAXIMO_ARCHIVO_MB` | `--maximo-archivo-mb` | 95 | Tamaño máximo de archivo en el chat |
| `MEET_URL_PUBLICA` | `--url-publica` | (túnel rápido) | Dominio propio en lugar de trycloudflare |
| `MEET_SIN_TUNEL`, `MEET_SIN_UPNP`, `MEET_SIN_NAVEGADOR` | `--sin-tunel`, `--sin-upnp`, `--sin-navegador` | false | Desactivan cada paso del arranque |
| `MEET_TURN_CLOUDFLARE_ID`, `MEET_TURN_CLOUDFLARE_TOKEN` | (solo entorno) | vacío | Relé TURN de Cloudflare para atravesar CGNAT |
| `MEET_ORIGENES_PERMITIDOS` | (solo entorno) | vacío | Hosts extra desde los que se acepta la señalización, separados por comas |

`agora.env` contiene claves y está en `.gitignore`: no lo subas al repositorio.

## Estructura

```
servidor-go/        Servidor Go: señalización, SFU (Pion), túnel, UPnP, firewall y web embebida
  web/              Aquí se copia la web compilada (no se versiona)
src/
  app/              Next.js: layout, página única y fuentes
  componentes/      Interfaz: inicio, sala de espera, reunión y pantalla final
  estado/           Estado de la reunión (zustand) y controles locales
  medios/           Cámara, micrófono, sonidos y detección de voz
  red/              Cliente de señalización, conexión con el SFU y protocolo
  cifrado/          Claves de la reunión, cifrado de medios (trabajador), y mensajes
despliegue/ubuntu/  Servicio systemd e instalador para Linux
scripts/            Desarrollo y construcción de los ejecutables
pruebas/            Pruebas de extremo a extremo con Playwright
marca/              Logotipo e iconos
sitio/              Página de presentación (GitHub Pages)
```

## Desarrollo

Necesitas Node 22.18 o superior y Go 1.21 o superior (Go descarga solo la versión que pide el proyecto).

```bash
npm install
npm run dev      # servidor Go en :8090 y web con recarga en http://localhost:3100
npm run exe      # dist/AgoraServidor.exe y dist/agora-servidor-linux
npm test         # pruebas del servidor (Go)
npm run test:e2e # dos navegadores contra http://localhost:8090 (requiere Playwright)
API_ANTIGUA=1 npm run test:e2e  # lo mismo con la API de cifrado antigua de Chrome
node pruebas/e2e-grande.cjs http://localhost:8090 12   # reunión de 12 con paginación
```

Opciones del servidor: `AgoraServidor.exe --help` (puertos, sin túnel, sin UPnP, URL pública
propia, máximos por sala…).

Para publicarlo en un servidor Ubuntu: [`despliegue/ubuntu/LEEME.md`](despliegue/ubuntu/LEEME.md).

## Identidad

*Ágora* era la plaza donde los griegos se reunían a conversar y decidir. El símbolo es la A de
Ágora, cuyo interior son las gradas de un anfiteatro (que también se leen como ondas de voz),
sobre una escalinata. Originales en `marca/logo-dark.svg` (para fondos claros) y
`marca/logo-light.svg` (para fondos oscuros); la paleta está en `tailwind.config.js`:

| Color | Hex | Uso |
|---|---|---|
| Azul Egeo Oscuro | `#1A2432` | Texto principal, tipografía del logo, iconos y fondo de la sala |
| Blanco Mármol | `#F8F9FA` | Fondo principal de la interfaz |
| Gris Caliza | `#E2E4E8` | Paneles laterales, modales y bordes sutiles |
| Terracota Ánfora | `#C55B43` | Botones de acción («Unirse ahora», «Nueva reunión») y avisos |
| Dorado Cívico | `#D4A373` | Acentos secundarios y estados activos (quién habla, botones encendidos) |

Tipografía de marca: Cinzel (letras de inscripción clásica, licencia OFL), solo en el logotipo.

## Licencia

Ágora es software libre bajo la [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0).
Puedes usarlo, estudiarlo, modificarlo y redistribuirlo; si ofreces una versión modificada como
servicio a otras personas, debes publicar también su código. La fuente Cinzel tiene su propia
licencia (SIL OFL 1.1, ver `src/app/fuentes/LICENCIA.txt`).
