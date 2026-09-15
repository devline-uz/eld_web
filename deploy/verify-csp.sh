#!/usr/bin/env bash
# Verifies the production CSP against a real build — web/tz.md §17, web/decisions.md WD-058.
#
# 1. Builds the panel with production-shaped env (API https://eldapi.stackyard.uz, dev auth mode as
#    deployed today, a dummy Sentry DSN so the lazy SDK chunk and its ingest request are exercised,
#    and the key-less MapLibre demo style so the map + blob: workers really run).
# 2. Serves that build through a private nginx on 127.0.0.1:$CSP_PORT that `include`s
#    deploy/nginx-security-headers.conf verbatim — only the map-host line is swapped for the demo
#    tile host. System nginx is never touched.
# 3. Runs deploy/csp.spec.ts in Chromium with eldadmin.stackyard.uz resolved to that nginx, so the
#    origin, the API and CORS are exactly production's: sign-in → Dashboard → Live Fleet map →
#    a thrown error reaches Sentry scrubbed. Any CSP violation fails the run.
set -euo pipefail

WEB="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${CSP_WORKDIR:-$(mktemp -d)}"
PORT="${CSP_PORT:-18443}"
MAP_HOST="https://demotiles.maplibre.org"
mkdir -p "$WORK/tmp" "$WORK/logs"

echo "▸ build → $WORK/dist"
(
  cd "$WEB"
  VITE_API_BASE_URL=https://eldapi.stackyard.uz/api \
  VITE_WS_URL=https://eldapi.stackyard.uz \
  VITE_AUTH_MODE=dev \
  VITE_MAP_STYLE_URL="$MAP_HOST/style.json" \
  VITE_SENTRY_DSN=https://0123456789abcdef0123456789abcdef@o0.ingest.us.sentry.io/0 \
  VITE_APP_VERSION=csp-verify \
    npx vite build --mode production --outDir "$WORK/dist" --emptyOutDir --logLevel warn
)

sed "s#^set \$eld_map_hosts .*#set \$eld_map_hosts     \"$MAP_HOST\";#" \
  "$WEB/deploy/nginx-security-headers.conf" > "$WORK/security-headers.conf"

openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj "/CN=eldadmin.stackyard.uz" \
  -keyout "$WORK/key.pem" -out "$WORK/cert.pem" 2>/dev/null

cat > "$WORK/nginx.conf" <<EOF
user root;
worker_processes 1;
pid $WORK/nginx.pid;
error_log $WORK/logs/error.log warn;
events { worker_connections 64; }
http {
  include /etc/nginx/mime.types;
  access_log off;
  client_body_temp_path $WORK/tmp/body;
  proxy_temp_path $WORK/tmp/proxy;
  fastcgi_temp_path $WORK/tmp/fastcgi;
  uwsgi_temp_path $WORK/tmp/uwsgi;
  scgi_temp_path $WORK/tmp/scgi;
  server {
    listen 127.0.0.1:$PORT ssl;
    server_name eldadmin.stackyard.uz;
    ssl_certificate $WORK/cert.pem;
    ssl_certificate_key $WORK/key.pem;
    root $WORK/dist;
    index index.html;
    include $WORK/security-headers.conf;
    location / { try_files \$uri \$uri/ /index.html; }
  }
}
EOF

nginx -t -p "$WORK" -c "$WORK/nginx.conf"
nginx -p "$WORK" -c "$WORK/nginx.conf"
# Stops only this private instance (signals the pid file in $WORK).
trap 'nginx -p "$WORK" -c "$WORK/nginx.conf" -s quit || true' EXIT

echo "▸ playwright (CSP) against https://eldadmin.stackyard.uz → 127.0.0.1:$PORT"
cd "$WEB"
CSP_PORT="$PORT" npx playwright test --config deploy/csp.playwright.config.ts
