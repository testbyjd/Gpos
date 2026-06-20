# GPOS Deploy Guide

Production server path: `/opt/gpos`

## Safe deploy (normal update)

```bash
cd /opt/gpos
git pull

# Backend — migrations only, NEVER fresh on prod
cd backend
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache
php artisan route:cache

# Frontend
cd ../frontend
npm ci
npm run build
# Restart Next.js / PM2 / systemd as per your setup
```

## NEVER on production

```bash
php artisan migrate:fresh   # ❌ Sab data delete — sirf local dev
php artisan db:seed         # ❌ Prod pe sirf jab naya empty DB ho
```

`migrate:fresh` se purchases, sales, khata — sab wipe ho jata hai. Agar count 0 dikhe aur data tha, yeh common reason hai.

## Required migration (UX trust batch)

```bash
php artisan migrate --force
# Adds purchases.client_id for duplicate-safe posting
```

## Verify after deploy

1. Login owner se — dashboard numbers load hon
2. Purchase post karo — list mein GRN dikhe
3. POS bill — "Sale Completed" ke baad invoice # confirm karo
4. Offline badge aaye to checkout band hona chahiye

## Local dev (fresh DB OK)

```bash
cd backend
php artisan migrate:fresh --seed
```

Default seed logins: see `backend/database/seeders` or project README.
