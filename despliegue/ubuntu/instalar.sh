#!/usr/bin/env bash
# Instala o actualiza Kubox Meet en el Ubuntu de casa, detrás del Cloudflare Tunnel de Kubox.
# Antes: compila en tu PC con `npm run exe` y copia dist/kubox-meet-servidor-linux a /opt/kubox-meet/.
#
#   sudo mkdir -p /opt/kubox-meet && sudo cp kubox-meet-servidor-linux /opt/kubox-meet/
#   sudo cp kubox-meet.env.example /opt/kubox-meet/kubox-meet.env && sudo nano /opt/kubox-meet/kubox-meet.env
#   sudo bash instalar.sh
set -euo pipefail
RAIZ=/opt/kubox-meet
AQUI="$(cd "$(dirname "$0")" && pwd)"

[[ $EUID -eq 0 ]] || { echo "Ejecuta con sudo." >&2; exit 1; }
[[ -x "$RAIZ/kubox-meet-servidor-linux" ]] || { echo "Falta $RAIZ/kubox-meet-servidor-linux (npm run exe)." >&2; exit 1; }
[[ -f "$RAIZ/kubox-meet.env" ]] || { echo "Falta $RAIZ/kubox-meet.env (ver kubox-meet.env.example)." >&2; exit 1; }

id kubox-meet >/dev/null 2>&1 || useradd --system --home "$RAIZ" --shell /usr/sbin/nologin kubox-meet
chown -R kubox-meet:kubox-meet "$RAIZ"
chmod 600 "$RAIZ/kubox-meet.env"

cp "$AQUI/kubox-meet-servidor.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable kubox-meet-servidor
systemctl restart kubox-meet-servidor

echo "Listo. En el túnel de Cloudflare publica: meet.tu-dominio  ->  http://localhost:8090"
echo "Registros: journalctl -u kubox-meet-servidor -f"
