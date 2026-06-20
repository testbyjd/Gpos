# GPOS Deploy Guide

Production server path: `/opt/gpos`

## Quick update (server)

```bash
sudo bash /opt/gpos/deploy/update.sh
```

## Manual update

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
NEXT_PUBLIC_API_BASE_URL=/api/v1 npm run build
# postbuild auto-copies .next/static → standalone (required!)
sudo chown -R www-data:www-data .next
sudo systemctl restart gpos-frontend
```

## Stuck on "Checking session..." + console 500 on `/_next/static/`

Next.js **standalone** build does not bundle static JS/CSS. Agar sirf `npm run build` chala aur **static copy + service restart** miss ho gaya:

- HTML load hoti hai ("Checking session...")
- JS chunks **500** dete hain → app kabhi hydrate nahi hoti

**Fix on server:**

```bash
cd /opt/gpos/frontend
NEXT_PUBLIC_API_BASE_URL=/api/v1 npm run build
# postbuild copies static automatically (since UX trust batch)
sudo chown -R www-data:www-data .next
sudo systemctl restart gpos-frontend
```

Verify: browser DevTools → Network → `/_next/static/chunks/*.js` should be **200**, not 500.

## NEVER on production

```bash
php artisan migrate:fresh   # ❌ Sab data delete — sirf local dev
php artisan db:seed         # ❌ Prod pe sirf jab naya empty DB ho
```

## Verify after deploy

1. `/pos/login` — Sign in form dikhe (not endless "Checking session...")
2. Login owner se — dashboard numbers load hon
3. Purchase post karo — list mein GRN dikhe
4. POS bill — "Sale Completed" ke baad invoice # confirm karo

## Local dev (fresh DB OK)

```bash
cd backend
php artisan migrate:fresh --seed
```
