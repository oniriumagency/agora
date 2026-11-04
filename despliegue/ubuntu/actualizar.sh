#!/usr/bin/env bash
# Actualiza el servidor de Ágora sin contraseña (lo instala permitir-actualizaciones.sh como
# /usr/local/sbin/agora-actualizar). Solo cambia el ejecutable, que corre como el usuario sin
# privilegios "agora"; la unidad de systemd y la configuración no se tocan desde aquí.
# Si el servicio no arranca con la versión nueva, vuelve solo a la anterior.
set -euo pipefail
PAQUETE="__PAQUETE__"
RAIZ=/opt/agora
[[ $EUID -eq 0 ]] || { echo "Ejecuta: sudo agora-actualizar" >&2; exit 1; }
[[ -f "$PAQUETE" ]] || { echo "No está $PAQUETE" >&2; exit 1; }

temporal=$(mktemp -d)
trap 'rm -rf "$temporal"' EXIT
tar xzf "$PAQUETE" -C "$temporal" --no-same-owner agora/agora-servidor-linux
nuevo="$temporal/agora/agora-servidor-linux"
[[ -f "$nuevo" && ! -L "$nuevo" ]] || { echo "El paquete no trae un ejecutable normal" >&2; exit 1; }
file "$nuevo" | grep -q "ELF 64-bit" || { echo "El paquete no trae un ejecutable de Linux válido" >&2; exit 1; }

cp -p "$RAIZ/agora-servidor-linux" "$RAIZ/agora-servidor-linux.anterior"
install -o agora -g agora -m 755 "$nuevo" "$RAIZ/agora-servidor-linux"
systemctl restart agora

esperar() {
  for _ in $(seq 1 30); do
    curl -fsS http://localhost:8090/salud >/dev/null 2>&1 && return 0
    sleep 1
  done
  return 1
}
if esperar; then
  echo "== Ágora actualizado: $(sha256sum "$RAIZ/agora-servidor-linux" | cut -c1-12)"
else
  echo "!! La versión nueva no arrancó; se vuelve a la anterior" >&2
  install -o agora -g agora -m 755 "$RAIZ/agora-servidor-linux.anterior" "$RAIZ/agora-servidor-linux"
  systemctl restart agora
  exit 1
fi
