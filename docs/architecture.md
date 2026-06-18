# Architecture Overview

## High-level

```
┌──────────────┐     HTTPS / REST (/api/v1)     ┌──────────────────┐
│  Next.js     │  ───────────────────────────►  │  Laravel API     │
│  POS + Admin │  ◄───────────────────────────  │  (modular)       │
└──────┬───────┘        JSON + Sanctum          └────────┬─────────┘
       │                                                  │
       │ offline queue (IndexedDB)               PostgreSQL
       │ auto-sync on reconnect                          │
       │                                          ┌───────▼────────┐
┌──────▼────────┐  localhost (ESC/POS)            │  Moving-avg    │
│ Print Bridge  │  ◄──────────────────────────    │  cost engine   │
│ printer+drawer│                                  └────────────────┘
└───────────────┘
```

## Backend — modular by domain

Har domain `backend/app/Modules/<Module>` ke andar self-contained hai:

| Module      | Responsibility                                              |
|-------------|------------------------------------------------------------|
| `Inventory` | Products, fractional units, stock movement log, low-stock  |
| `Sales`     | POS tickets, payments (split), hold/resume, day-end till   |
| `Customers` | Khata/Udhaar ledger, running balance, repayments           |
| `Vendors`   | Vendor master, goods-received, payables ledger             |
| `Reports`   | Day-end, P&L (avg cost), top-selling                        |
| `Hardware`  | Receipt payload contract, print-bridge integration         |
| `Auth`      | RBAC (Admin/Cashier), Sanctum, manager-PIN override        |

Shared cheezein `app/Shared` aur `app/Support` mein.

### Conventions
- Controllers thin; business logic `Services` mein.
- DB access `Repositories` ke through (testability).
- Validation `Http/Requests`, API output shape `Http/Resources`.
- Har module apni routes `Routes/api.php` mein expose karta hai, root `routes/api.php` se `v1` prefix ke under load hoti hain.

## Frontend — feature-based

`src/features/<feature>` mein `components / hooks / api / types / store`.
Cross-cutting: `src/lib` (api client, offline sync, utils), `src/components/ui` (shared primitives).

App Router route groups:
- `(pos)` — cashier-facing fast checkout (offline-critical)
- `(admin)` — owner/admin dashboards, inventory, reports
- `(auth)` — login

## Offline strategy (POS only)
- Billing flow writes to IndexedDB first → instant receipt + local stock deduction.
- A sync queue replays transactions to `/api/v1` when connection returns.
- Server is source of truth; conflicts resolved server-side on sync.
- Admin/reports/inventory-edit = online-only (acceptable per plan §2.1).

## Key decisions
See [`docs/decisions/`](./decisions/) — one file per locked decision (costing, offline, hardware, single-store).
