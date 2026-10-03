#!/usr/bin/env bash
# Web panelni production'ga chiqarish: pull → npm ci → build → dist/ ni nginx root'ga ko'chirish → tekshirish.
# Ishga tushirish (serverda, istalgan joydan):  bash deploy/deploy-web.sh
# Sozlash (env):  BRANCH=main  WEB_ROOT=/var/www/eldadmin.stackyard.uz  SITE_URL=https://eldadmin.stackyard.uz
#                 ALLOW_LOCALHOST=1 — API URL localhost bo'lsa ham davom etish.
# nginx'ni qayta ishga tushirish shart emas: fayllar statik, nginx har so'rovda diskdan o'qiydi.
set -euo pipefail

BRANCH="${BRANCH:-main}"
WEB_ROOT="${WEB_ROOT:-/var/www/eldadmin.stackyard.uz}"
SITE_URL="${SITE_URL:-https://eldadmin.stackyard.uz}"
ALLOW_LOCALHOST="${ALLOW_LOCALHOST:-0}"
WEB_ROOT="${WEB_ROOT%/}"

die() { echo "XATO: $*" >&2; exit 1; }

# Repo ildiziga o'tish (skript deploy/ ichida turadi).
cd "$(dirname "${BASH_SOURCE[0]}")/.."
REPO_DIR="$(pwd)"
echo "==> Repo: $REPO_DIR"

# 1. Commit qilinmagan o'zgarishlar bo'lsa — to'xtash.
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  git status --short --untracked-files=no >&2
  die "ishchi daraxtda commit qilinmagan o'zgarishlar bor. Avval ularni hal qiling."
fi

# 2. Kodni yangilash.
echo "==> git: $BRANCH"
git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
echo "==> Commit: $(git log -1 --oneline)"

# 3. Env tekshiruvi. Vite prod build tartibi (keyingisi ustun):
#    .env → .env.local → .env.production → .env.production.local; shell'dagi export eng ustun.
env_value() { # $1 = kalit; fayllardan oxirgi qiymatni chiqaradi
  local key="$1" val="" f line
  for f in .env .env.local .env.production .env.production.local; do
    [ -f "$f" ] || continue
    line="$(grep -E "^[[:space:]]*(export[[:space:]]+)?${key}[[:space:]]*=" "$f" | tail -n 1 || true)"
    [ -n "$line" ] || continue
    val="${line#*=}"
    val="${val%$'\r'}"
    val="$(printf '%s' "$val" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//; s/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/')"
  done
  if [ -n "${!key+x}" ]; then val="${!key}"; fi
  printf '%s' "$val"
}

API_URL="$(env_value VITE_API_BASE_URL)"
AUTH_MODE="$(env_value VITE_AUTH_MODE)"
echo "==> VITE_API_BASE_URL=${API_URL:-<bo'sh>}"
echo "==> VITE_AUTH_MODE=${AUTH_MODE:-<bo'sh>}"
if [ "$ALLOW_LOCALHOST" != "1" ]; then
  [ -n "$API_URL" ] || die "VITE_API_BASE_URL bo'sh (.env.production ni tekshiring)."
  case "$API_URL" in
    *localhost*|*127.0.0.1*) die "VITE_API_BASE_URL localhost'ga qaragan: $API_URL (ALLOW_LOCALHOST=1 bilan chetlab o'tish mumkin)." ;;
  esac
fi

# 4. Toza o'rnatish va build (npm ci — lockfile'dagi aniq versiyalar, aks holda bundle budget buzilishi mumkin).
echo "==> npm ci"
npm ci
rm -rf dist
echo "==> npm run build"
npm run build
[ -f dist/index.html ] || die "dist/index.html topilmadi — build muvaffaqiyatsiz."

# Source map'lar dist/ dan sourcemaps/ ga ko'chiriladi (scripts/extract-sourcemaps.mjs); qayta ishonch hosil qilamiz.
if find dist -name '*.map' -print -quit | grep -q .; then
  die "dist/ ichida .map fayllar qoldi — deploy qilinmaydi."
fi

# 5. Entry hash.
entry_of() { grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' | head -n 1 || true; }
NEW_ENTRY="$(entry_of < dist/index.html)"
[ -n "$NEW_ENTRY" ] || die "dist/index.html da entry (assets/index-*.js) topilmadi."
echo "==> Yangi entry: $NEW_ENTRY"

# 6. Zaxira va ko'chirish.
if [ -d "$WEB_ROOT" ]; then
  echo "==> Zaxira: ${WEB_ROOT}.bak"
  rm -rf "${WEB_ROOT}.bak"
  cp -a "$WEB_ROOT" "${WEB_ROOT}.bak"
fi
mkdir -p "$WEB_ROOT"
echo "==> Ko'chirish: dist/ → $WEB_ROOT/"
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete dist/ "$WEB_ROOT/"
else
  find "$WEB_ROOT" -mindepth 1 -delete
  cp -a dist/. "$WEB_ROOT/"
fi

# 7. Tekshirish: diskdagi va jonli saytdagi entry bir xil bo'lishi kerak.
DEPLOYED_ENTRY="$(entry_of < "$WEB_ROOT/index.html")"
[ "$DEPLOYED_ENTRY" = "$NEW_ENTRY" ] || die "$WEB_ROOT/index.html entry mos emas: '$DEPLOYED_ENTRY' ≠ '$NEW_ENTRY'."

LIVE_HTML="$(curl -fsS -H 'Cache-Control: no-cache' "$SITE_URL/")" || die "$SITE_URL/ ochilmadi."
LIVE_ENTRY="$(printf '%s' "$LIVE_HTML" | entry_of)"
LAST_MODIFIED="$(curl -fsSI "$SITE_URL/" | tr -d '\r' | grep -i '^last-modified:' | cut -d' ' -f2- || true)"
if [ "$LIVE_ENTRY" != "$NEW_ENTRY" ]; then
  die "jonli sayt eski: $SITE_URL entry '${LIVE_ENTRY:-?}', kutilgan '$NEW_ENTRY'. nginx root $WEB_ROOT dan farq qilishi mumkin (grep -n root /etc/nginx/sites-enabled/*) yoki CDN keshi."
fi
[ -n "$LAST_MODIFIED" ] || LAST_MODIFIED="noma'lum"
echo "OK: $SITE_URL → $NEW_ENTRY (last-modified: $LAST_MODIFIED)"
