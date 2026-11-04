# Kubox Meet

Videoconferencias P2P al estilo Google Meet, hermano de Kubox sin la parte de juego: entras con un
enlace, ves y oyes a todos, y tienes micrófono y cámara, chat, mano alzada, reacciones y pantalla compartida.

- **Next.js 14 + TypeScript + Tailwind** en `src/` (cliente).
- **Servidor de señalización** en `servidor/` (Node + `ws`): admite a cada persona en su sala,
  retransmite la señalización WebRTC y reparte estado, chat y reacciones. Nunca toca el audio ni el vídeo.
- **WebRTC en malla**: cada participante conecta directamente con todos los demás. Pensado para
  reuniones de hasta 8 personas (configurable con `MEET_MAXIMO_POR_SALA`).
- **TURN de Cloudflare Realtime** con credenciales temporales generadas en el servidor (igual que Kubox).

## Arrancar en tu equipo

Necesitas Node 22.18 o superior.

```bash
npm install
npm run dev          # señalización en :8180 y web en http://localhost:3100
```

Abre `http://localhost:3100`, crea una reunión y abre el mismo enlace en otra pestaña o navegador.
Para probar desde otro dispositivo de tu red hace falta HTTPS (los navegadores solo dan cámara y
micrófono en `localhost` o en HTTPS), así que lo más cómodo es el despliegue en el Ubuntu.

Producción local: `npm run build`, y luego `npm run servidor` y `npm start` en dos terminales.

## Funciones

| Función | Cómo |
| :--- | :--- |
| Sala de espera | Vista previa, elección de micrófono y cámara, nombre recordado |
| Micrófono / cámara | Botones o `Ctrl+D` / `Ctrl+E`. La cámara se apaga de verdad (se suelta el dispositivo) |
| Mano alzada | Botón o `Ctrl+Alt+H`. En "Personas" aparecen por orden de llegada |
| Chat | Panel lateral o `Ctrl+Alt+C`; quien llega tarde recibe el historial. Enlaces clicables |
| Reacciones | 👍 ❤️ 😂 😮 👏 🎉 flotando en pantalla |
| Presentar pantalla | Se destaca en grande para todos; cualquier tesela se puede fijar |
| Indicador de voz | Anillo y ondas en quien habla |
| Reconexión | Si se cae la señalización, vuelve a entrar sola |

## Cómo funciona la conexión

Cada conexión lleva siempre tres pistas en el mismo orden: audio, cámara y pantalla. Quien llega
ofrece a los que ya estaban y ellos solo responden, así nunca hay ofertas cruzadas. Apagar la
cámara o empezar a presentar cambia la pista con `replaceTrack`, sin renegociar. El estado visible
(micrófono, cámara, mano, quién presenta) lo reparte el servidor, que asigna las identidades: nadie
puede hacerse pasar por otro participante.

Protocolo: [`servidor/src/protocolo.ts`](servidor/src/protocolo.ts), compartido por cliente y servidor.

## Pruebas

```bash
npm run typecheck
npm test                       # servidor: salas, señal, estado, chat, límites y validación
npm run test:e2e               # dos Chromium con cámara simulada (requiere Playwright y la app en marcha)
```

## Publicar

Ver [`despliegue/ubuntu/LEEME.md`](despliegue/ubuntu/LEEME.md): mismo Cloudflare Tunnel que Kubox, subdominio `meet`.
