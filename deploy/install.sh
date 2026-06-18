#!/usr/bin/env bash
# GPOS bare-metal installer — Ubuntu 22.04/24.04
# Run as root after: git clone … /opt/gpos && cd /opt/gpos
#
#   sudo bash deploy/install.sh
#
# Optional env overrides:
#   DOMAIN=gondaltrader.com APP_DIR=/opt/gpos DB_PASSWORD='secret' CERTBOT_EMAIL=you@mail.com

set -euo pipefail

DOMAIN="${DOMAIN:-gondaltrader.com}"
APP_DIR="${APP_DIR:-/opt/gpos}"
DB_NAME="${DB_NAME:-gpos}"
DB_USER="${DB_USER:-gpos}"
DB_PASSWORD="${DB_PASSWORD:-}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
RUN_CERTBOT="${RUN_CERTBOT:-1}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/install.sh" >&2
  exit 1
fi

if [[ ! -f "$APP_DIR/backend/artisan" ]]; then
  echo "Repo not found at $APP_DIR — git clone first." >&2
  exit 1
fi

if [[ -z "$DB_PASSWORD" ]]; then
  DB_PASSWORD="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 24)"
  echo "[install] Generated DB password (saved in backend/.env): $DB_PASSWORD"
fi

if [[ "${SKIP_APT:-0}" == "1" ]] || { command -v nginx >/dev/null && command -v php8.3 >/dev/null && command -v composer >/dev/null && command -v psql >/dev/null; }; then
  echo "[install] System packages already present — skipping apt."
else
  echo "[install] Installing system packages…"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq \
    nginx postgresql postgresql-contrib \
    php8.3-fpm php8.3-cli php8.3-pgsql php8.3-mbstring php8.3-xml php8.3-curl php8.3-zip php8.3-bcmath \
    composer nodejs npm certbot python3-certbot-nginx \
    git curl unzip
fi

# Node 20+ for Next.js — use NodeSource if distro node is too old.
NODE_MAJOR="$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1 || echo 0)"
if [[ "${NODE_MAJOR:-0}" -lt 20 ]]; then
  echo "[install] Upgrading Node.js via NodeSource…"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi

echo "[install] PostgreSQL user + database…"
if sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
  sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
else
  sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
fi
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

echo "[install] Backend (Laravel)…"
cd "$APP_DIR/backend"
if [[ ! -f .env ]]; then
  cp .env.example .env
fi

# Patch production .env values.
sed -i "s|^APP_ENV=.*|APP_ENV=production|" .env
sed -i "s|^APP_DEBUG=.*|APP_DEBUG=false|" .env
sed -i "s|^APP_URL=.*|APP_URL=https://$DOMAIN|" .env
sed -i "s|^DB_HOST=.*|DB_HOST=127.0.0.1|" .env
sed -i "s|^DB_PORT=.*|DB_PORT=5432|" .env
sed -i "s|^DB_DATABASE=.*|DB_DATABASE=$DB_NAME|" .env
sed -i "s|^DB_USERNAME=.*|DB_USERNAME=$DB_USER|" .env
sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=$DB_PASSWORD|" .env
sed -i "s|^SESSION_DRIVER=.*|SESSION_DRIVER=file|" .env
sed -i "s|^CACHE_STORE=.*|CACHE_STORE=file|" .env
sed -i "s|^QUEUE_CONNECTION=.*|QUEUE_CONNECTION=sync|" .env

export COMPOSER_ALLOW_SUPERUSER=1
composer install --no-dev --optimize-autoloader --no-interaction
grep -q '^APP_KEY=base64:' .env || php artisan key:generate --force
chown -R www-data:www-data storage bootstrap/cache
chmod -R ug+rwx storage bootstrap/cache
php artisan migrate --force
php artisan config:cache

echo "[install] Frontend (Next.js)…"
cd "$APP_DIR/frontend"
npm ci
NEXT_PUBLIC_API_BASE_URL=/api/v1 npm run build
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
chown -R www-data:www-data .next

echo "[install] Nginx + systemd…"
cp "$APP_DIR/deploy/nginx/gondaltrader.com.conf" /etc/nginx/sites-available/gondaltrader.com
ln -sf /etc/nginx/sites-available/gondaltrader.com /etc/nginx/sites-enabled/gondaltrader.com
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now php8.3-fpm
systemctl reload nginx

cp "$APP_DIR/deploy/systemd/gpos-frontend.service" /etc/systemd/system/gpos-frontend.service
systemctl daemon-reload
systemctl enable --now gpos-frontend

if [[ "$RUN_CERTBOT" == "1" && -n "$CERTBOT_EMAIL" ]]; then
  echo "[install] SSL via Certbot…"
  certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" \
    --non-interactive --agree-tos -m "$CERTBOT_EMAIL" --redirect
elif [[ "$RUN_CERTBOT" == "1" ]]; then
  echo "[install] Skip Certbot (set CERTBOT_EMAIL=you@mail.com to enable HTTPS)."
  echo "          HTTP works on port 80 until you run certbot manually."
fi

echo ""
echo "============================================"
echo " GPOS installed at $APP_DIR"
echo " Site:  https://$DOMAIN/pos/login"
echo " DB:    $DB_NAME / user $DB_USER"
echo ""
echo " Seed users (one time):"
echo "   cd $APP_DIR/backend && php artisan db:seed --class=GposSeeder --force"
echo "============================================"
