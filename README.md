# Ágora

Reuniones por vídeo al estilo Google Meet con **servidor propio**: cualquiera abre
`AgoraServidor.exe` en su PC, el programa prepara la red y muestra el enlace que hay que
compartir. Cámara y micrófono, chat, mano alzada, reacciones, pantalla compartida y reuniones grandes.

## Funciones

- Cámara, micrófono y pantalla compartida, con selector de dispositivos y vista previa antes de entrar.
- Chat con enlaces y archivos (hasta 95 MB), mano alzada y reacciones flotantes.
- Mosaico paginado para reuniones grandes, vista de una sola persona y pantalla completa.
- Anfitrión: silenciar y expulsar.
- Celular: modo bolsillo, sigue la llamada con la pantalla bloqueada y recupera el sitio tras un corte.
- Instalable como app (PWA) y sin cuentas: basta con compartir el enlace de la sala.

## Cómo se usa

1. Abre `AgoraServidor.exe` (doble clic). Al arrancar:
   - Pide permiso de administrador una vez para crear la regla del **Firewall de Windows**.
   - Intenta abrir el puerto de vídeo en el **router** (UPnP o NAT-PMP) y avisa si no puede o si
     hay **CGNAT** (entonces desde Internet hace falta TURN, ver abajo).
   - Abre un **enlace público HTTPS** con un túnel rápido de Cloudflare (gratis, sin cuenta; la
     primera vez descarga `cloudflared`).
   - Muestra los enlaces y abre el navegador.
2. Comparte el enlace `https://….trycloudflare.com`. En tu misma red también vale
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

Crea `agora.env` junto al `.exe` con tu clave TURN de Cloudflare Realtime (la misma de Kubox
sirve; plantilla en `despliegue/ubuntu/agora.env.example`):

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
- **Un puerto de medios** (8091 UDP y TCP) para todas las conexiones; TCP sirve en redes que
  bloquean UDP.
- **Web** (`src/`, Next.js 14 + TypeScript + Tailwind) exportada como archivos estáticos.

### ¿Cuánta gente cabe?

El límite real es la **subida** de quien aloja: cada persona que mira recibe hasta 9 vídeos
(entre 300 y 500 kbps cada uno en reuniones grandes, porque la calidad baja sola con el tamaño) y
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
despliegue/ubuntu/  Servicio systemd e instalador para Linux
scripts/            Desarrollo y construcción de los ejecutables
pruebas/            Pruebas de extremo a extremo con Playwright
marca/              Logotipo e iconos
```

## Desarrollo

Necesitas Node 22.18 o superior y Go 1.21 o superior (Go descarga solo la versión que pide el proyecto).

```bash
npm install
npm run dev      # servidor Go en :8090 y web con recarga en http://localhost:3100
npm run exe      # dist/AgoraServidor.exe y dist/agora-servidor-linux
npm test         # pruebas del servidor (Go)
npm run test:e2e # dos navegadores contra http://localhost:8090 (requiere Playwright)
node pruebas/e2e-grande.cjs http://localhost:8090 12   # reunión de 12 con paginación
```

Opciones del servidor: `AgoraServidor.exe --help` (puertos, sin túnel, sin UPnP, URL pública
propia, máximos por sala…).

Para publicarlo en el Ubuntu de casa: [`despliegue/ubuntu/LEEME.md`](despliegue/ubuntu/LEEME.md).

## Identidad

*Ágora* era la plaza donde los griegos se reunían a conversar y decidir. El símbolo es un
anfiteatro visto desde arriba (gradas y pasillos, que también se leen como ondas de voz) con el
escenario en oro. Archivos en `marca/`; la paleta está en `tailwind.config.js`:

| Color | Uso | Hex |
|---|---|---|
| Azul egeo | acento, botones | `#1F5FA6` · claro `#8DBFEA` |
| Noche del Egeo | fondo de la sala | `#0F1B2D` · superficies `#18293F`, `#22385A` |
| Mármol | páginas claras, texto sobre oscuro | `#FAF7F1` · `#F3EEE3` |
| Oro de ánfora | detalles, greca, avisos | `#D9AE4E` |
| Terracota | colgar, errores | `#D0603B` |
| Olivo | apoyo | `#7D8B4E` |

Tipografía de marca: Cinzel (letras de inscripción clásica, licencia OFL), solo en el logotipo.
