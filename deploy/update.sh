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

echo "[update] Timezone (Pakistan / Karachi)…"
if command -v timedatectl >/dev/null 2>&1; then
  timedatectl set-timezone Asia/Karachi
  echo "[update] OS timezone: $(timedatectl show -p Timezone --value)"
else
  echo "[update] timedatectl not found — set TZ=Asia/Karachi manually if needed." >&2
fi
ENV_FILE="$APP_DIR/backend/.env"
if [[ -f "$ENV_FILE" ]]; then
  if grep -q '^APP_TIMEZONE=' "$ENV_FILE"; then
    sed -i 's/^APP_TIMEZONE=.*/APP_TIMEZONE=Asia\/Karachi/' "$ENV_FILE"
  else
    echo 'APP_TIMEZONE=Asia/Karachi' >> "$ENV_FILE"
  fi
  echo "[update] Laravel APP_TIMEZONE=Asia/Karachi"
fi

echo "[update] Backend…"
cd "$APP_DIR/backend"
export COMPOSER_ALLOW_SUPERUSER=1
composer install --no-dev --optimize-autoloader --no-interaction
php artisan migrate --force
php artisan storage:link --force 2>/dev/null || true
php artisan config:cache
php artisan route:cache
systemctl reload php8.3-fpm 2>/dev/null || true

echo "[update] Frontend…"
cd "$APP_DIR/frontend"
rm -rf .next
npm ci
NEXT_PUBLIC_API_BASE_URL=/api/v1 npm run build
chown -R www-data:www-data .next

if grep -rq "tasks/summary" "$APP_DIR/frontend/.next/static/chunks" 2>/dev/null; then
  echo "[update] Task UI present in static bundle."
elif grep -rq "tasks/summary" "$APP_DIR/frontend/.next/standalone/.next/static/chunks" 2>/dev/null; then
  echo "[update] Task UI present in standalone bundle."
else
  echo "[update] WARNING: Task UI not found in build — check npm run build output." >&2
fi

if [[ -f "$APP_DIR/deploy/nginx/gondaltrader.com.conf" ]]; then
  cp "$APP_DIR/deploy/nginx/gondaltrader.com.conf" /etc/nginx/sites-available/gondaltrader.com
  nginx -t
  systemctl reload nginx
  echo "[update] Nginx config reloaded."
fi

echo "[update] Restart Next.js…"
systemctl restart gpos-frontend
systemctl is-active --quiet gpos-frontend && echo "[update] gpos-frontend running."

echo ""
echo "Done. Open https://gondaltrader.com/pos/login"
