#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="/opt/pos-modern-api/server"
DATA_DIR="/var/lib/pos-modern-api"
SERVICE_NAME="pos-modern-api"
PORT="${POS_PORT:-3000}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this installer with sudo:"
  echo "  sudo bash $0"
  exit 1
fi
SOURCE_DIR="${SCRIPT_DIR}/server"
if [[ ! -f "${SOURCE_DIR}/package.json" || ! -f "${SOURCE_DIR}/server.js" ]]; then
  echo "The server folder is missing or invalid: ${SOURCE_DIR}"
  exit 1
fi

echo "Installing operating-system requirements..."
apt-get update
apt-get install -y ca-certificates curl gnupg build-essential python3 rsync

NODE_MAJOR=22
install -d -m 0755 /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
  | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
  > /etc/apt/sources.list.d/nodesource.list
apt-get update
apt-get install -y nodejs

if ! id -u posmodern >/dev/null 2>&1; then
  useradd --system --home-dir "${DATA_DIR}" --shell /usr/sbin/nologin posmodern
fi
systemctl stop "${SERVICE_NAME}.service" 2>/dev/null || true
install -d -m 0755 /opt/pos-modern-api
install -d -o posmodern -g posmodern -m 0750 "${DATA_DIR}"
install -d -m 0755 "${INSTALL_DIR}"

rsync -a --delete --exclude node_modules --exclude backups --exclude tests \
  --exclude 'config/pos-modern.db*' "${SOURCE_DIR}/" "${INSTALL_DIR}/"
cd "${INSTALL_DIR}"
npm ci --omit=dev
chown -R root:root /opt/pos-modern-api

cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=POS Modern central API
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=posmodern
Group=posmodern
WorkingDirectory=${INSTALL_DIR}
Environment=NODE_ENV=production
Environment=POS_DATA_DIR=${DATA_DIR}
Environment=POS_PORT=${PORT}
ExecStart=/usr/bin/node ${INSTALL_DIR}/server.js
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${DATA_DIR}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now "${SERVICE_NAME}.service"
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q '^Status: active'; then
  ufw allow "${PORT}/tcp" comment 'POS Modern API'
fi

HEALTH_URL="http://127.0.0.1:${PORT}/api/health"
healthy=0
for _ in $(seq 1 30); do
  if curl --fail --silent "${HEALTH_URL}" | grep -q 'modern-pos-api'; then
    healthy=1
    break
  fi
  sleep 1
done
if [[ "${healthy}" -ne 1 ]]; then
  journalctl -u "${SERVICE_NAME}.service" -n 50 --no-pager
  exit 1
fi

echo "POS Modern API is installed and running. Client URLs:"
hostname -I | tr ' ' '\n' | grep -v '^$' | while read -r address; do
  echo "  http://${address}:${PORT}"
done
