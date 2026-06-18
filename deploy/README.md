# GPOS — VPS deploy (Nginx + PostgreSQL + Certbot)

No Docker. Standard Ubuntu stack — same as tum pehle karte thay.

```
Internet ──► Nginx :443 (Certbot SSL)
                ├─ /api/*   → PHP 8.3-FPM (Laravel)
                ├─ /pos/*   → Node (Next.js standalone)
                ├─ /login   → redirect → /pos/login
                └─ /        → static coming soon
             PostgreSQL (local)
```

## Prerequisites

- Ubuntu 22.04 or 24.04 VPS
- Domain DNS → server IP (Cloudflare **DNS only** / gray cloud is fine)
- Git access to this repo

## 1. Clone on server

```bash
ssh root@YOUR_SERVER_IP
git clone https://github.com/testbyjd/Gpos.git /opt/gpos
cd /opt/gpos
```

## 2. Run installer

```bash
# HTTPS + seed email (recommended)
sudo CERTBOT_EMAIL=you@mail.com bash deploy/install.sh

# HTTP only first (skip certbot)
sudo RUN_CERTBOT=0 bash deploy/install.sh
```

Installer kya karta hai:
- PostgreSQL, PHP 8.3-FPM, Nginx, Node 22, Composer, Certbot
- Laravel `composer install`, migrate, config cache
- Next.js build + systemd service `gpos-frontend`
- Nginx site `deploy/nginx/gondaltrader.com.conf`

## 3. Seed shop users (one time)

```bash
cd /opt/gpos/backend
php artisan db:seed --class=GposSeeder --force
```

| Role | Email | Password |
|------|-------|----------|
| Owner | gondaljpj@gmail.com | Shehzad91 |
| Manager | shahbaz@gondal.local | Shahbaz27 |
| Cashier | casher1@gondal.com | Cashier38 |

## 4. Open the app

- Staff login: `https://gondaltrader.com/login`
- POS: `https://gondaltrader.com/pos`
- API health: `https://gondaltrader.com/api/v1/health`

## SSL (manual Certbot)

Agar install ke waqt email nahi di:

```bash
sudo certbot --nginx -d gondaltrader.com -d www.gondaltrader.com
```

Cloudflare pe **DNS only** rakho jab tak Certbot complete na ho.

## Updates (git pull)

```bash
cd /opt/gpos
git pull

cd backend
composer install --no-dev --optimize-autoloader --no-interaction
php artisan migrate --force
php artisan config:cache

cd ../frontend
npm ci
NEXT_PUBLIC_API_BASE_URL=/api/v1 npm run build
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

sudo systemctl restart gpos-frontend
sudo systemctl reload php8.3-fpm nginx
```

## DB backup

```bash
sudo -u postgres pg_dump -Fc gpos > gpos-$(date +%F).dump
```

## Files

| Path | Purpose |
|------|---------|
| `deploy/install.sh` | One-shot server setup |
| `deploy/nginx/gondaltrader.com.conf` | Nginx vhost |
| `deploy/systemd/gpos-frontend.service` | Next.js service |
| `deploy/www/index.html` | Coming soon page at `/` |

## Custom domain / path

Edit `DOMAIN` and nginx `server_name` if not `gondaltrader.com`:

```bash
sudo DOMAIN=myshop.com CERTBOT_EMAIL=me@mail.com bash deploy/install.sh
```

`APP_DIR` default: `/opt/gpos`
