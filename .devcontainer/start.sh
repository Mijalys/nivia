#!/usr/bin/env bash
# Arranca Nivia para pruebas en un GitHub Codespace: API + app en el puerto 3000 y la clase 1 cargada.
# Solo para demostración: base PGlite, correos al log y datos de demostración.
set -euo pipefail
cd "$(dirname "$0")/../backend"
[ -d node_modules ] || npm ci
npm run build >/dev/null

mkdir -p .data
# Clave de administrador propia de este Codespace (el puerto puede ser público).
[ -f .data/admin-password ] || openssl rand -hex 12 > .data/admin-password
export ADMIN_PASSWORD="$(cat .data/admin-password)"
[ -f .data/app-secret ] || openssl rand -hex 32 > .data/app-secret
export APP_SECRET="$(cat .data/app-secret)"
export DEFAULT_TENANT=programa-claude
if [ -n "${CODESPACE_NAME:-}" ]; then
  export PUBLIC_URL="https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
else
  export PUBLIC_URL="http://localhost:3000"
fi

pkill -f "node dist/main.js" 2>/dev/null || true
setsid nohup node dist/main.js > /tmp/nivia-api.log 2>&1 < /dev/null &
for _ in $(seq 1 60); do curl -sf http://localhost:3000/app/ >/dev/null && break; sleep 1; done

node scripts/cargar-contenido.mjs --api http://localhost:3000 --dir ../contenido/programa-claude --storage ./storage
echo
echo "Nivia lista en: ${PUBLIC_URL}/app/"
echo "Administrador: admin / $(cat .data/admin-password)"
