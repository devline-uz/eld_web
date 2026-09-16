#!/usr/bin/env bash
# 2026-09-16 perf: eldapi → JSON gzip + http2; eldadmin → asset gzip + immutable kesh + http2.
# Ishga tushirish (foydalanuvchi):  ! bash web/deploy/nginx-perf-20260916.sh
set -euo pipefail
cd /etc/nginx/sites-enabled
cp eldapi.stackyard.uz   /root/eldapi.stackyard.uz.bak-20260916
cp eldadmin.stackyard.uz /root/eldadmin.stackyard.uz.bak-20260916
python3 - <<'PY'
p='/etc/nginx/sites-enabled/eldapi.stackyard.uz'; s=open(p).read()
if 'gzip_proxied' not in s:
    s=s.replace("    client_max_body_size 12m;\n","""    client_max_body_size 12m;

    # 2026-09-16 perf: JSON javoblarini siqish (avval /users 162KB xom ketardi)
    gzip on;
    gzip_proxied any;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 5;
    gzip_types application/json text/plain text/css application/javascript;
""",1)
s=s.replace("listen [::]:443 ssl; # managed","listen [::]:443 ssl http2; # managed").replace("listen 443 ssl; # managed","listen 443 ssl http2; # managed")
open(p,'w').write(s)
p='/etc/nginx/sites-enabled/eldadmin.stackyard.uz'; s=open(p).read()
if 'immutable' not in s:
    s=s.replace("    location / { try_files $uri $uri/ /index.html; }\n","""    # 2026-09-16 perf: gzip + uzoq muddatli kesh (Vite fayl nomlarida hash bor)
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 6;
    gzip_types text/css application/javascript application/json image/svg+xml font/ttf font/woff2 application/manifest+json;

    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }
    location / {
        add_header Cache-Control "no-cache";
        try_files $uri $uri/ /index.html;
    }
""",1)
s=s.replace("listen [::]:443 ssl; # managed","listen [::]:443 ssl http2; # managed").replace("listen 443 ssl; # managed","listen 443 ssl http2; # managed")
open(p,'w').write(s)
PY
nginx -t && systemctl reload nginx && echo "OK: nginx reloaded"
