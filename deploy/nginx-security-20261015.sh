#!/usr/bin/env bash
# 2026-10-15 LV-04: eldadmin.stackyard.uz → security headers + `server_tokens off`.
# Run on the web server as root (the user runs it; agents never touch system nginx):
#   sudo bash deploy/nginx-security-20261015.sh
#
# What it does (idempotent — safe to run twice):
#   1. Backs up /etc/nginx/sites-enabled/eldadmin.stackyard.uz to /root/…bak-20261015.
#   2. Copies deploy/nginx-security-headers.conf to /etc/nginx/snippets/onebook-eld-security-headers.conf.
#   3. Adds `include …;` to the HTTPS server block (right after its `root` line) AND inside every
#      `location { … }` that declares its own add_header (nginx does not inherit server-level
#      add_header into such a location — since nginx-perf-20260916.sh both `location /assets/` and
#      `location /` set Cache-Control, so a server-level include alone would send nothing).
#   4. `nginx -t`; on failure restores the backup and exits non-zero. On success reloads nginx.
#   5. Prints the headers of /, an SPA route and one hashed asset.
set -euo pipefail

SITE=/etc/nginx/sites-enabled/eldadmin.stackyard.uz
SNIPPET=/etc/nginx/snippets/onebook-eld-security-headers.conf
BACKUP=/root/eldadmin.stackyard.uz.bak-20261015
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/nginx-security-headers.conf"
URL="${SITE_URL:-https://eldadmin.stackyard.uz}"

[ -f "$SITE" ] || { echo "XATO: $SITE topilmadi" >&2; exit 1; }
[ -f "$SRC" ]  || { echo "XATO: $SRC topilmadi" >&2; exit 1; }

[ -f "$BACKUP" ] || cp "$SITE" "$BACKUP"
mkdir -p /etc/nginx/snippets
install -m 0644 "$SRC" "$SNIPPET"

python3 - "$SITE" "$SNIPPET" <<'PY'
import re, sys
path, snippet = sys.argv[1], sys.argv[2]
inc = f"include {snippet};"
lines = open(path).read().split("\n")

roots = [i for i, l in enumerate(lines) if re.match(r"\s*root\s+\S+;", l)]
if len(roots) != 1:
    sys.exit(f"XATO: {path} ichida `root` qatori {len(roots)} ta (1 kutilgan) — include'ni qo'lda qo'ying.")

out, i = [], 0
while i < len(lines):
    line = lines[i]
    out.append(line)
    indent = re.match(r"\s*", line).group(0)
    # 1) server level: right after the single `root …;` line.
    if i == roots[0] and (i + 1 >= len(lines) or inc not in lines[i + 1]):
        out.append(f"{indent}{inc}")
    # 2) multi-line `location … {` whose own block has add_header.
    if re.match(r"\s*location\b[^{]*\{\s*(#.*)?$", line):
        depth, j, body = 1, i + 1, []
        while j < len(lines) and depth:
            depth += lines[j].count("{") - lines[j].count("}")
            body.append(lines[j]); j += 1
        if any("add_header" in b for b in body) and not any(inc in b for b in body):
            out.append(f"{indent}    {inc}")
    # one-line `location / { … add_header … }` cannot be patched safely.
    elif re.match(r"\s*location\b.*\{.*add_header.*\}", line):
        sys.exit(f"XATO: bir qatorli location add_header bilan: {line.strip()} — qo'lda tahrirlang.")
    i += 1
open(path, "w").write("\n".join(out))
PY

echo "── $SITE (o'zgargan qismi):"
diff -u "$BACKUP" "$SITE" || true

if nginx -t; then
  systemctl reload nginx
  echo "OK: nginx reloaded"
else
  echo "XATO: nginx -t muvaffaqiyatsiz — backup tiklanmoqda" >&2
  cp "$BACKUP" "$SITE"
  nginx -t && systemctl reload nginx || true
  exit 1
fi

check() {
  echo "── $1"
  curl -sI "$1" | grep -iE '^(server|content-security-policy|strict-transport|x-frame|x-content-type|referrer-policy|permissions-policy|cross-origin|cache-control):' || true
}
check "$URL/"
check "$URL/live-fleet"
ASSET="$(curl -s "$URL/" | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -n 1 || true)"
[ -n "$ASSET" ] && check "$URL$ASSET"
