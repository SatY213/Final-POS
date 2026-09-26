#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
INSTALLER="${SCRIPT_DIR}/INSTALL_API_SERVER_UBUNTU.sh"

if [[ ! -f "${INSTALLER}" ]]; then
  echo "INSTALL_API_SERVER_UBUNTU.sh is missing from ${SCRIPT_DIR}."
  exit 1
fi
if [[ ! -d "${SCRIPT_DIR}/server" ]]; then
  echo "The updated server folder is missing from ${SCRIPT_DIR}."
  exit 1
fi

echo "Updating POS Modern API. The database in /var/lib/pos-modern-api will be preserved."
if [[ "${EUID}" -eq 0 ]]; then
  exec bash "${INSTALLER}"
else
  exec sudo bash "${INSTALLER}"
fi
