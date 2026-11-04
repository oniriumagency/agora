# Ágora en la torre Ubuntu · agora.onirium.agency

La torre ejecuta el servidor de Ágora como servicio (`agora`), que arranca solo al encender y se
reinicia si se cae. Se publica por el mismo Cloudflare Tunnel de Kubox (`magne-homelab`), así que no
hay que abrir puertos en el router (que tiene CGNAT). El vídeo atraviesa el CGNAT con el TURN de
Cloudflare, igual que en Windows.

## 1. Llevar el paquete a la torre

En Windows, `dist\agora-ubuntu.tar.gz` (lo genera `npm run exe`) lleva el servidor, el instalador y la
configuración. Cópialo a la torre (cambia `usuario@torre` por el tuyo):

```powershell
scp "dist\agora-ubuntu.tar.gz" usuario@torre:
```

Opcional: para no volver a pegar las claves TURN, copia también tu `agora.env` (o el antiguo `kubox-meet.env`) y ponlo dentro
de la carpeta `agora` después de descomprimir.

## 2. Instalar (o actualizar)

```bash
tar xzf agora-ubuntu.tar.gz
cd agora
sudo bash instalar.sh
```

Si no encuentra un `agora.env` o `kubox-meet.env` al lado, te pide las dos claves del TURN de
Cloudflare (Realtime > TURN Server: *Turn Token ID* y *API Token*). Quedan en `/opt/agora/agora.env`,
legible solo por el servicio.

Para actualizar más adelante, repite lo mismo con el paquete nuevo: conserva la configuración.

## 3. Publicar el subdominio (una sola vez)

Cloudflare > Zero Trust > Networks > Tunnels > `magne-homelab` > **Public Hostname** > *Add a public hostname*:

| Campo | Valor |
|---|---|
| Subdomain | `agora` |
| Domain | `onirium.agency` |
| Service | `HTTP` · `localhost:8090` |

Cloudflare crea el registro DNS solo. Los WebSockets y las subidas de archivos (hasta 100 MB)
funcionan con el plan gratis. Si `cloudflared` corre en otra máquina, pon la IP de la torre en
lugar de `localhost`.

## Día a día

```bash
systemctl status agora          # ¿está corriendo?
journalctl -u agora -f          # registro en vivo (quién entra y sale)
sudo systemctl restart agora    # reiniciar tras editar /opt/agora/agora.env
```
