#!/usr/bin/env bash
# Una sola vez: permite actualizar Ágora sin contraseña, y solo eso.
#   sudo bash permitir-actualizaciones.sh
# Instala /usr/local/sbin/agora-actualizar (propiedad de root) y una regla de sudoers que deja a
# tu usuario ejecutar ese único comando sin contraseña. Ese comando solo sustituye el ejecutable
# del servicio, que corre sin privilegios: no da acceso de administrador a quien lo use.
# Para quitarlo: sudo rm /etc/sudoers.d/agora-actualizar /usr/local/sbin/agora-actualizar
set -euo pipefail
[[ $EUID -eq 0 && -n "${SUDO_USER:-}" ]] || { echo "Ejecuta con sudo desde tu usuario: sudo bash permitir-actualizaciones.sh" >&2; exit 1; }
AQUI="$(cd "$(dirname "$0")" && pwd)"
CASA=$(getent passwd "$SUDO_USER" | cut -d: -f6)

sed "s|__PAQUETE__|$CASA/agora-ubuntu.tar.gz|" "$AQUI/actualizar.sh" > /usr/local/sbin/agora-actualizar
chown root:root /usr/local/sbin/agora-actualizar
chmod 755 /usr/local/sbin/agora-actualizar

regla=$(mktemp)
echo "$SUDO_USER ALL=(root) NOPASSWD: /usr/local/sbin/agora-actualizar" > "$regla"
visudo -cf "$regla" >/dev/null
install -o root -g root -m 440 "$regla" /etc/sudoers.d/agora-actualizar
rm -f "$regla"
echo "== Listo: $SUDO_USER puede ejecutar 'sudo agora-actualizar' sin contraseña."
