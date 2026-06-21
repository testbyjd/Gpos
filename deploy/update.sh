#!/usr/bin/env bash
# Production update — run on the VPS as root:
#   sudo bash /opt/gpos/deploy/update.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/gpos}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/update.sh" >&2
  exit 1
fi

cd "$APP_DIR"
git pull

echo "[update] Backend…"
cd "$APP_DIR/backend"
export COMPOSER_ALLOW_SUPERUSER=1
composer install --no-dev --optimize-autoloader --no-interaction
php artisan migrate --force
php artisan config:cache
php artisan route:cache

echo "[update] Frontend…"
cd "$APP_DIR/frontend"
npm ci
NEXT_PUBLIC_API_BASE_URL=/api/v1 npm run build
chown -R www-data:www-data .next

if ! rg -q "tasks/summary" "$APP_DIR/frontend/.next/static/chunks" 2>/dev/null; then
  echo "[update] WARNING: Task UI not found in build — check npm run build output." >&2
else
  echo "[update] Task UI present in static bundle."
fi

echo "[update] Restart Next.js…"
systemctl restart gpos-frontend
systemctl is-active --quiet gpos-frontend && echo "[update] gpos-frontend running."

echo ""
echo "Done. Open https://gondaltrader.com/pos/login"
