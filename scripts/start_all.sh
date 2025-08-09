#!/usr/bin/env bash
set -euo pipefail

# Resolve project root as the parent of this script dir
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

API_HOST="127.0.0.1"
API_PORT="8000"
WEB_PORT="3001"
# Optional override: set PKG_MGR to one of: bun | yarn | npm
PKG_MGR="${PKG_MGR:-}"

echo "[+] Project root: ${PROJECT_ROOT}"

echo "[+] Freeing ports ${API_PORT}, 3000, ${WEB_PORT} if occupied"
lsof -tiTCP:${API_PORT},3000,${WEB_PORT} | xargs -r kill || true
sleep 1

cd "${PROJECT_ROOT}"

echo "[+] Ensuring Python venv and dependencies"
if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
"${PROJECT_ROOT}/.venv/bin/python" -m pip install --upgrade pip >/dev/null
"${PROJECT_ROOT}/.venv/bin/pip" install -r requirements.txt >/dev/null

echo "[+] Starting API on http://${API_HOST}:${API_PORT}"
nohup "${PROJECT_ROOT}/.venv/bin/uvicorn" api:app --host ${API_HOST} --port ${API_PORT} --reload \
  > /tmp/crypto-api.log 2>&1 &
sleep 1

echo "[+] Waiting for API to be healthy"
for i in {1..30}; do
  if curl -sf "http://${API_HOST}:${API_PORT}/health" >/dev/null; then
    echo "[+] API is up"
    break
  fi
  sleep 0.5
done

echo "[+] Preparing frontend .env.local"
mkdir -p "${PROJECT_ROOT}/web"
cd "${PROJECT_ROOT}/web"
echo "NEXT_PUBLIC_API_BASE=http://${API_HOST}:${API_PORT}" > .env.local

cd "${PROJECT_ROOT}/web"

# Decide package manager
choose_pkg_mgr() {
  if [[ -n "${PKG_MGR}" ]]; then
    echo "${PKG_MGR}"
    return 0
  fi
  if command -v bun >/dev/null 2>&1 || [[ -x "$HOME/.bun/bin/bun" ]]; then
    echo "bun"; return 0
  fi
  if command -v yarn >/dev/null 2>&1; then
    echo "yarn"; return 0
  fi
  echo "npm"; return 0
}

PKG_MGR_SELECTED="$(choose_pkg_mgr)"

echo "[+] Using package manager: ${PKG_MGR_SELECTED}"

case "${PKG_MGR_SELECTED}" in
  bun)
    if ! command -v bun >/dev/null 2>&1; then
      if [[ ! -x "$HOME/.bun/bin/bun" ]]; then
        echo "[+] Installing Bun"
        curl -fsSL https://bun.sh/install | bash >/dev/null
      fi
      export BUN_INSTALL="$HOME/.bun"
      export PATH="$BUN_INSTALL/bin:$PATH"
    fi
    echo "[+] Installing web dependencies with Bun"
    bun install >/dev/null
    echo "[+] Starting Next.js (Bun) on http://localhost:${WEB_PORT}"
    nohup bun run dev -- -p ${WEB_PORT} > /tmp/crypto-web-bun-${WEB_PORT}.log 2>&1 &
    ;;
  yarn)
    echo "[+] Installing web dependencies with Yarn"
    yarn install --frozen-lockfile || yarn install
    echo "[+] Starting Next.js (Yarn) on http://localhost:${WEB_PORT}"
    nohup yarn run dev -- -p ${WEB_PORT} > /tmp/crypto-web-yarn-${WEB_PORT}.log 2>&1 &
    ;;
  npm)
    echo "[+] Installing web dependencies with npm"
    npm ci || npm install
    echo "[+] Starting Next.js (npm) on http://localhost:${WEB_PORT}"
    nohup npm run dev -- -p ${WEB_PORT} > /tmp/crypto-web-npm-${WEB_PORT}.log 2>&1 &
    ;;
esac

sleep 2

echo "[+] Verifying web server is listening"
lsof -iTCP:${WEB_PORT} -sTCP:LISTEN | cat || true

echo "[+] Done. Open:"
echo "    API: http://${API_HOST}:${API_PORT} (health: /health)"
echo "    Web: http://localhost:${WEB_PORT}"


