# Publicar Kubox Meet en el Ubuntu de casa (junto a Kubox)

Kubox Meet usa el mismo esquema que Kubox: el Cloudflare Tunnel que ya tienes (sirve con CGNAT)
publica la web y la señalización en un subdominio, y el TURN de Cloudflare Realtime transporta el
vídeo cuando no hay conexión directa entre dos participantes.

```
navegador ─► Cloudflare (HTTPS) ─► cloudflared ─┬─► 127.0.0.1:3100  Next.js       (kubox-meet-web)
                                                └─► 127.0.0.1:8180  Señalización  (kubox-meet-servidor, ruta /senal)
```

Los puertos no chocan con Kubox (3000 y 8080), así que ambos conviven en el mismo Ubuntu.

## Instalar

```bash
sudo git clone https://github.com/oniriumagency/KuboxMeet.git /opt/kubox-meet
sudo install -D -m 600 /opt/kubox-meet/despliegue/ubuntu/despliegue.env.example /etc/kubox-meet/despliegue.env
sudo nano /etc/kubox-meet/despliegue.env      # dominio y clave TURN (puede ser la misma de Kubox)
sudo bash /opt/kubox-meet/despliegue/ubuntu/instalar.sh
```

Si no usas GitHub, copia la carpeta a `/opt/kubox-meet` (sin `node_modules` ni `.next`) y sigue igual.

## Rutas en el túnel

Cloudflare Zero Trust → Networks → Tunnels → `magne-homelab` → *Public Hostname*. Añade, en este orden:

1. Subdominio `meet`, dominio `onirium.agency`, **ruta `senal`**, servicio `HTTP` → `localhost:8180`
2. Subdominio `meet`, dominio `onirium.agency`, sin ruta, servicio `HTTP` → `localhost:3100`

Cloudflare crea el DNS solo. La web llega a la señalización en `wss://meet.onirium.agency/senal` sin configurar nada más.

## ¿Quién puede entrar?

Cualquiera con el enlace de una reunión puede unirse (como en Meet con enlace abierto). Si quieres
restringirlo, protege `meet.onirium.agency` con Cloudflare Access (Zero Trust → Access →
Applications → Self-hosted) igual que Kubox; cubre también `/senal`. Ten en cuenta que entonces cada
invitado tendrá que estar en la política de Access.

## Comprobar y actualizar

```bash
systemctl status kubox-meet-servidor kubox-meet-web
journalctl -u kubox-meet-servidor -f      # debe decir "[TURN] Credenciales temporales de Cloudflare renovadas"
curl -s localhost:8180/salud               # "ok N salas"

cd /opt/kubox-meet && sudo -u kubox-meet git pull && sudo bash despliegue/ubuntu/instalar.sh
```

Prueba desde el móvil con datos (no con el wifi de casa): si el vídeo no llega, casi siempre falta la clave TURN.
