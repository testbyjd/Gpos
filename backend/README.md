# Backend — Laravel API

Modular Laravel 11 API · PostgreSQL · Sanctum.

## Local dev

```bash
# PostgreSQL (Ubuntu)
sudo apt install postgresql
sudo -u postgres createuser -P gpos
sudo -u postgres createdb -O gpos gpos

cd backend
cp .env.example .env
composer install
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

API base: `http://localhost:8000/api/v1`

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/health` | Connection check |
| `POST /api/v1/sync/push` | POS sale submit |
| `POST /api/v1/auth/login` | Staff login |

## Production (VPS)

See [`deploy/README.md`](../deploy/README.md) — Nginx + PHP-FPM + Certbot, no Docker.

## Structure

```
app/Modules/
  Auth/       stores, users (role: owner|manager|cashier)
  Inventory/  products, categories, stock_movements
  Sales/      sales, lines, payments, till
  Customers/  khata customers
  Vendors/    purchases, payables
  Sync/       push endpoint
  Reports/    dashboard, P&L
```

Module routes auto-load from `app/Modules/*/Routes/api.php` under `/api/v1`.

## Seed users

After `migrate --seed` or `db:seed --class=GposSeeder`:
- Owner: `gondaljpj@gmail.com` / `Shehzad91`
- Cashier: `casher1@gondal.com` / `Cashier38`

Full list: [`deploy/README.md`](../deploy/README.md)
