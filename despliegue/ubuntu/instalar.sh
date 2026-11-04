#!/usr/bin/env bash
# Instala o actualiza Ágora en la torre Ubuntu (detrás del Cloudflare Tunnel magne-homelab).
# Uso, dentro de la carpeta descomprimida de agora-ubuntu.tar.gz:
#   sudo bash instalar.sh                      # dominio por defecto: agora.onirium.agency
#   sudo bash instalar.sh otro.dominio.com     # otro dominio
# Si junto a este script hay un agora.env (o el kubox-meet.env de Windows), se usan sus claves TURN.
set -euo pipefail
DOMINIO="${1:-agora.onirium.agency}"
RAIZ=/opt/agora
AQUI="$(cd "$(dirname "$0")" && pwd)"

[[ $EUID -eq 0 ]] || { echo "Ejecuta con sudo: sudo bash instalar.sh" >&2; exit 1; }
[[ -f "$AQUI/agora-servidor-linux" ]] || { echo "Falta agora-servidor-linux junto a este script." >&2; exit 1; }

echo "== Ágora -> https://$DOMINIO"
id agora >/dev/null 2>&1 || useradd --system --home "$RAIZ" --shell /usr/sbin/nologin agora
mkdir -p "$RAIZ"
systemctl stop agora 2>/dev/null || true
install -m 755 "$AQUI/agora-servidor-linux" "$RAIZ/agora-servidor-linux"

# Configuración: se conserva la existente; si no hay, se crea (con las claves TURN si vinieron).
if [[ ! -f "$RAIZ/agora.env" ]]; then
  origen=""
  for candidato in "$AQUI/agora.env" "$AQUI/kubox-meet.env"; do [[ -f "$candidato" ]] && origen="$candidato" && break; done
  cp "$AQUI/agora.env.example" "$RAIZ/agora.env"
  if [[ -n "$origen" ]]; then
    for clave in MEET_TURN_CLOUDFLARE_ID MEET_TURN_CLOUDFLARE_TOKEN; do
      valor="$(grep -E "^$clave=" "$origen" | tail -1 | cut -d= -f2- | tr -d '\r')"
      [[ -n "$valor" ]] && sed -i "s|^$clave=.*|$clave=$valor|" "$RAIZ/agora.env"
    done
    echo "   Claves TURN copiadas de $(basename "$origen")."
  elif [[ -t 0 ]]; then
    echo "   Pega las claves del TURN de Cloudflare (Realtime > TURN Server). Enter para dejarlo para luego."
    read -rp "   Turn Token ID: " id_turn
    read -rsp "   API Token (no se muestra): " token_turn; echo
    [[ -n "$id_turn" ]] && sed -i "s|^MEET_TURN_CLOUDFLARE_ID=.*|MEET_TURN_CLOUDFLARE_ID=$id_turn|" "$RAIZ/agora.env"
    [[ -n "$token_turn" ]] && sed -i "s|^MEET_TURN_CLOUDFLARE_TOKEN=.*|MEET_TURN_CLOUDFLARE_TOKEN=$token_turn|" "$RAIZ/agora.env"
  fi
fi
sed -i "s|^MEET_URL_PUBLICA=.*|MEET_URL_PUBLICA=https://$DOMINIO|" "$RAIZ/agora.env"
chown -R agora:agora "$RAIZ"
chmod 600 "$RAIZ/agora.env"

# Puerto de vídeo (si ufw está activo). Con CGNAT el vídeo llega por TURN, pero en la red local va directo.
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 8091/udp >/dev/null && ufw allow 8091/tcp >/dev/null && echo "   ufw: abierto 8091 UDP/TCP."
fi

install -m 644 "$AQUI/agora.service" /etc/systemd/system/agora.service
systemctl daemon-reload
systemctl enable --now agora >/dev/null 2>&1
systemctl restart agora
sleep 3

if curl -fsS http://localhost:8090/salud >/dev/null; then
  echo "== Ágora está corriendo en http://localhost:8090"
else
  echo "!! Ágora no respondió. Mira: journalctl -u agora -n 50" >&2
fi
grep -q "^MEET_TURN_CLOUDFLARE_TOKEN=." "$RAIZ/agora.env" || echo "!! Falta el TURN: edita $RAIZ/agora.env y luego: sudo systemctl restart agora"
cat <<FIN

Último paso, en Cloudflare (una sola vez):
  Zero Trust > Networks > Tunnels > magne-homelab > Public Hostname > Add
    Subdomain: ${DOMINIO%%.*}   Domain: ${DOMINIO#*.}   Service: HTTP  localhost:8090
  Cloudflare crea el DNS solo. Luego abre https://$DOMINIO

Registros en vivo: journalctl -u agora -f
FIN
