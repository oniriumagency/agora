#!/usr/bin/env bash
# Instala o actualiza Kubox Meet en el Ubuntu de casa, junto a Kubox y detrás del mismo Cloudflare
# Tunnel: Node 24 si hace falta, compilación y dos servicios de systemd (web 3100, señalización 8180).
#
#   sudo git clone https://github.com/oniriumagency/KuboxMeet.git /opt/kubox-meet
#   sudo install -D -m 600 /opt/kubox-meet/despliegue/ubuntu/despliegue.env.example /etc/kubox-meet/despliegue.env
#   sudo nano /etc/kubox-meet/despliegue.env
#   sudo bash /opt/kubox-meet/despliegue/ubuntu/instalar.sh
set -euo pipefail

RAIZ=/opt/kubox-meet
DESPLIEGUE="$RAIZ/despliegue/ubuntu"
CONFIGURACION=/etc/kubox-meet/despliegue.env

[[ $EUID -eq 0 ]] || { echo "Ejecuta con sudo." >&2; exit 1; }
[[ -f "$CONFIGURACION" ]] || { echo "Falta $CONFIGURACION (ver despliegue.env.example)." >&2; exit 1; }
source "$CONFIGURACION"
[[ -n "${MEET_DOMINIO:-}" ]] || { echo "Completa MEET_DOMINIO en $CONFIGURACION." >&2; exit 1; }

echo "== Node (22.18 o superior: el servidor se ejecuta en TypeScript sin compilar)"
version_ok() { node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=18)?0:1)'; }
if ! command -v node >/dev/null || ! version_ok; then
  apt-get update && apt-get install -y curl
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi

echo "== Usuario"
id kubox-meet >/dev/null 2>&1 || useradd --system --home "$RAIZ" --shell /usr/sbin/nologin kubox-meet
chown -R kubox-meet:kubox-meet "$RAIZ"

echo "== .env.local de producción"
cat > "$RAIZ/.env.local" <<FIN
MEET_ORIGENES_PERMITIDOS=https://${MEET_DOMINIO}
MEET_CONFIAR_PROXY=true
MEET_MAXIMO_POR_SALA=${MEET_MAXIMO_POR_SALA:-8}
MEET_TURN_CLOUDFLARE_ID=${MEET_TURN_CLOUDFLARE_ID:-}
MEET_TURN_CLOUDFLARE_TOKEN=${MEET_TURN_CLOUDFLARE_TOKEN:-}
FIN
chown kubox-meet:kubox-meet "$RAIZ/.env.local" && chmod 600 "$RAIZ/.env.local"

echo "== Compilación"
cd "$RAIZ"
sudo -u kubox-meet -H npm ci --no-audit --no-fund
sudo -u kubox-meet -H npm run build

echo "== Servicios"
cp "$DESPLIEGUE/kubox-meet-servidor.service" "$DESPLIEGUE/kubox-meet-web.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable kubox-meet-servidor kubox-meet-web
systemctl restart kubox-meet-servidor kubox-meet-web

echo "Listo. En Cloudflare Zero Trust > Networks > Tunnels > tu túnel > Public Hostname, añade (la de /senal primero):"
echo "  ${MEET_DOMINIO}  ruta: senal  ->  http://localhost:8180"
echo "  ${MEET_DOMINIO}  (sin ruta)   ->  http://localhost:3100"
echo "Estado: systemctl status kubox-meet-servidor kubox-meet-web"
