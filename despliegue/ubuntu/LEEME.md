# Kubox Meet en el Ubuntu de casa (opcional)

Lo normal es que quien organiza abra `KuboxMeetServidor.exe` en su PC. Si prefieres un servidor
fijo en el Ubuntu, el mismo programa existe para Linux (`dist/kubox-meet-servidor-linux`).

En casa hay CGNAT, así que nadie de fuera puede llegar al puerto de vídeo del Ubuntu:

- La **web y la señalización** entran por el Cloudflare Tunnel que ya usas, con dominio propio.
- El **audio y el vídeo** van por el TURN de Cloudflare Realtime: los navegadores y el servidor se
  encuentran en el relé. Sin `MEET_TURN_CLOUDFLARE_*` no funcionará desde fuera de tu red.

```
navegador ─► Cloudflare (HTTPS) ─► cloudflared ─► 127.0.0.1:8090  Kubox Meet (web + señalización)
navegador ◄──── vídeo ────► TURN de Cloudflare ◄────► Kubox Meet (SFU)
```

## Instalar

En tu PC: `npm run exe`. Copia al Ubuntu `dist/kubox-meet-servidor-linux` y esta carpeta. En el Ubuntu:

```bash
sudo mkdir -p /opt/kubox-meet
sudo cp kubox-meet-servidor-linux /opt/kubox-meet/
sudo cp kubox-meet.env.example /opt/kubox-meet/kubox-meet.env
sudo nano /opt/kubox-meet/kubox-meet.env     # MEET_TURN_CLOUDFLARE_* y MEET_URL_PUBLICA=https://meet.onirium.agency
sudo bash instalar.sh
```

En Cloudflare Zero Trust → Networks → Tunnels → `magne-homelab` → *Public Hostname*: subdominio
`meet`, dominio `onirium.agency`, servicio `HTTP` → `localhost:8090` (una sola ruta: la web y
`/senal` las sirve el mismo programa).

## Comprobar

```bash
systemctl status kubox-meet-servidor
journalctl -u kubox-meet-servidor -f     # entradas y salidas de cada reunión
curl -s localhost:8090/salud              # ok
```

Prueba desde el móvil con datos (no con el wifi de casa).
