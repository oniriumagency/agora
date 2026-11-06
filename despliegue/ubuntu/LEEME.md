# Ágora en un servidor Ubuntu

El servidor de Ágora corre como servicio (`agora`): arranca solo al encender y se reinicia si se
cae. Esta guía lo publica con un **Cloudflare Tunnel**, así que no hace falta abrir puertos en el
router (sirve aunque tu conexión tenga CGNAT). El vídeo atraviesa el CGNAT con el TURN de
Cloudflare, igual que en Windows. Si prefieres otro proxy inverso (Caddy, nginx…), apúntalo a
`localhost:8090` y abre el puerto de medios 8091 UDP/TCP.

## 1. Llevar el paquete al servidor

`npm run exe` genera `dist/agora-ubuntu.tar.gz`, con el servidor, el instalador y la
configuración. Cópialo al servidor (cambia `usuario@servidor` por el tuyo):

```bash
scp dist/agora-ubuntu.tar.gz usuario@servidor:
```

Opcional: para no volver a pegar las claves TURN, copia también tu `agora.env` y ponlo dentro de la
carpeta `agora` después de descomprimir.

## 2. Instalar (o actualizar)

```bash
tar xzf agora-ubuntu.tar.gz
cd agora
sudo bash instalar.sh agora.tudominio.com   # la primera vez, con tu dominio
sudo bash instalar.sh                       # al actualizar, conserva el dominio configurado
```

Si no encuentra un `agora.env` al lado, te pide las dos claves del TURN de Cloudflare
(Realtime > TURN Server: *Turn Token ID* y *API Token*). Quedan en `/opt/agora/agora.env`,
legible solo por el servicio.

Para actualizar más adelante, repite lo mismo con el paquete nuevo: conserva la configuración.

### Actualizaciones sin contraseña (opcional, una vez)

```bash
sudo bash permitir-actualizaciones.sh
```

Crea el comando `sudo agora-actualizar`, que se puede ejecutar sin contraseña (también por SSH,
sin que estés delante). Solo cambia el ejecutable por el de `~/agora-ubuntu.tar.gz` y, si la
versión nueva no arranca, vuelve a la anterior. No da acceso de administrador: el servicio corre
con el usuario sin privilegios `agora`. Los cambios en `agora.service` siguen necesitando
`sudo bash instalar.sh`.

## 3. Publicar el subdominio (una sola vez)

Cloudflare > Zero Trust > Networks > Tunnels > (tu túnel) > **Public Hostname** > *Add a public hostname*:

| Campo | Valor |
|---|---|
| Subdomain | `agora` |
| Domain | `tudominio.com` |
| Service | `HTTP` · `localhost:8090` |

Cloudflare crea el registro DNS solo. Los WebSockets y las subidas de archivos (hasta 100 MB)
funcionan con el plan gratis. Si `cloudflared` corre en otra máquina, pon la IP del servidor en
lugar de `localhost`.

## Día a día

```bash
systemctl status agora          # ¿está corriendo?
journalctl -u agora -f          # registro en vivo (quién entra y sale)
sudo systemctl restart agora    # reiniciar tras editar /opt/agora/agora.env
```
