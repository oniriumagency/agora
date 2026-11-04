# Kubox Meet

Reuniones por vídeo al estilo Google Meet con **servidor propio**: cualquiera abre
`KuboxMeetServidor.exe` en su PC, el programa prepara la red y muestra el enlace que hay que
compartir. Cámara y micrófono, chat, mano alzada, reacciones, pantalla compartida y reuniones grandes.

## Cómo se usa

1. Abre `KuboxMeetServidor.exe` (doble clic). Al arrancar:
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

Crea `kubox-meet.env` junto al `.exe` con tu clave TURN de Cloudflare Realtime (la misma de Kubox
sirve; plantilla en `despliegue/ubuntu/kubox-meet.env.example`):

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

## Desarrollo

Necesitas Node 22.18 o superior y Go 1.21 o superior (Go descarga solo la versión que pide el proyecto).

```bash
npm install
npm run dev      # servidor Go en :8090 y web con recarga en http://localhost:3100
npm run exe      # dist/KuboxMeetServidor.exe y dist/kubox-meet-servidor-linux
npm test         # pruebas del servidor (Go)
npm run test:e2e # dos navegadores contra http://localhost:8090 (requiere Playwright)
node pruebas/e2e-grande.cjs http://localhost:8090 12   # reunión de 12 con paginación
```

Opciones del servidor: `KuboxMeetServidor.exe --help` (puertos, sin túnel, sin UPnP, URL pública
propia, máximos por sala…).

Para publicarlo en el Ubuntu de casa: [`despliegue/ubuntu/LEEME.md`](despliegue/ubuntu/LEEME.md).
