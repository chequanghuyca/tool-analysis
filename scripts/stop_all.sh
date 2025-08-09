#!/usr/bin/env bash
set -euo pipefail

PORTS=(8000 3000 3001)
echo "[+] Stopping services on ports: ${PORTS[*]}"
lsof -tiTCP:${PORTS[*]} | xargs -r kill || true
echo "[+] Stopped."


