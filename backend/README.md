# Backend — Laravel API

Modular Laravel 11 API · PostgreSQL · Sanctum · **offline sync** (`client_id` idempotency).

## Quick start

```bash
# from repo root — PostgreSQL
docker compose up -d

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
| `GET /api/v1/health` | Connection check (POS online indicator) |
| `POST /api/v1/sync/push` | Offline sales replay (idempotent by `client_id`) |
| `GET /api/v1/sync/pull?since=` | Catalog delta for local cache |

Full contract: [`docs/api/sync.md`](../docs/api/sync.md)

## Structure

```
app/Modules/
  Auth/       stores, users (role: owner|manager|cashier)
  Inventory/  products, categories, stock_movements, moving-avg
  Sales/      sales (+ client_id UUID), lines, payments
  Customers/  khata customers
  Vendors/    purchases, payables (next)
  Sync/       push/pull endpoints, sync_log audit
```

Module routes auto-load from `app/Modules/*/Routes/api.php` under `/api/v1`.

## Offline sync rules (locked)

1. POS writes sales locally first (IndexedDB) — frontend Phase 3.
2. Each sale has a **client-generated UUID** (`client_id`).
3. Duplicate push → `already_synced`, no double stock hit.
4. Pull refreshes products/customers changed since `since` timestamp.

See [`docs/decisions/05-offline-sync.md`](../docs/decisions/05-offline-sync.md).

## Dev seed

After `migrate --seed`:
- Store: Gondal Traders
- User: `cashier@gondal.local` / `password`
- Sample product: Cooking Oil 1L (barcode `8964000123456`)
