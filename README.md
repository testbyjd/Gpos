# Gondal Traders — Retail POS System

Point of Sale + Inventory Management system for a single-store grocery/general retail shop in Pakistan.
Offline-capable billing, fractional inventory, Khata (credit), vendor payables, aur day-end reconciliation.

> Full product scope: see [`plan.md`](./plan.md).

## Monorepo Layout

```
GPOS/
├── plan.md            # MVP plan / source of truth
├── docs/              # Architecture, API contracts, decisions, hardware notes
├── backend/           # Laravel API (PostgreSQL) — modular by domain
├── frontend/          # Next.js (App Router) — POS + Admin panel, feature-based
└── print-bridge/      # Local agent: thermal printer (ESC/POS) + cash drawer kick
```

## Why this structure

- **Monorepo** — backend, frontend, aur print-bridge ek jagah, par independently deployable.
- **Backend modular by domain** (`app/Modules/*`) — Inventory, Sales, Customers (Khata), Vendors, Reports, Hardware, Auth. Har module self-contained, taa ke naya domain add karna baaki ko na chhuye.
- **Frontend feature-based** (`src/features/*`) — har feature apne components/hooks/api/types le kar chalta hai.
- **Mobile-ready** — schema + versioned API (`/api/v1`) aise design hain ke Phase-2 Flutter app bina rework attach ho jaye.

## Getting Started

Detailed setup har sub-project ke apne README mein hai:
- [`backend/README.md`](./backend/README.md)
- [`frontend/README.md`](./frontend/README.md)
- [`print-bridge/README.md`](./print-bridge/README.md)

## Tech Stack

| Layer        | Tech                                             |
|--------------|--------------------------------------------------|
| Backend API  | Laravel (latest), PostgreSQL, Sanctum auth       |
| Frontend     | Next.js App Router, Tailwind CSS                  |
| Offline POS  | IndexedDB / local queue + auto-sync              |
| Hardware     | Local print bridge (ESC/POS thermal + drawer)    |
| Mobile       | Flutter (Post-MVP, Phase 2)                       |
