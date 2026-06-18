# Gondal Traders — Retail POS System (MVP Development Plan)

## 1. Project Overview & Objectives

This document defines the Minimum Viable Product (MVP) for a Point of Sale (POS) and Inventory Management System for a single grocery / general retail store in Pakistan operating on a traditional service-counter model.

The MVP goal is a **working, shippable system** that handles fast counter billing, inventory with fractional units, "Khata" (credit) management, vendor payables, and day-end reconciliation — built on a clean foundation that can grow later, but **without over-engineering the first version**.

**Scope discipline note:** "Scalable foundation" here means sane schema and clear module boundaries — NOT distributed/enterprise architecture. Anything not strictly required to run the shop on day one is marked **Post-MVP** and must be quoted separately.

---

## 2. Critical Decisions (Resolve Before Coding)

These decisions change the architecture. They are locked here so the developer does not assume.

### 2.1. Offline Capability — **REQUIRED**
Internet in local shops is unreliable. **Billing must never stop because the internet is down.**

- The POS register must support **offline billing**: create sale, print receipt, deduct stock locally even with no connection.
- Transactions queue locally and **sync to the server automatically** when the connection returns.
- Reports, admin panel, and inventory editing can be online-only (acceptable). Only the **checkout/billing flow** is offline-critical.
- Implementation is the developer's choice (local DB + sync queue, IndexedDB, PWA with service worker, or a local Electron/desktop wrapper). The **requirement** is non-negotiable; the **method** is open.

### 2.2. Single Store vs Multi-Store — **SINGLE STORE (MVP)**
- MVP targets one store, one till location.
- Schema should not hard-block multi-store later (e.g. keep a nullable `store_id`), but **no multi-store features are built now.**

### 2.3. Inventory Costing Method — **Moving (Weighted) Average**
- When new stock arrives at a different cost, recalculate the product's average cost:
  `new_avg = (old_qty × old_avg + received_qty × received_cost) / (old_qty + received_qty)`
- P&L uses this average cost at time of sale. No FIFO/batch costing in MVP.

### 2.4. Hardware Integration — **Non-Trivial, Scope It Properly**
A browser/web app **cannot** send raw ESC/POS bytes or a drawer-kick pulse directly. This needs a bridge.

- Use a **local print bridge** on each register PC (e.g. QZ Tray, a small local agent, or a native/desktop wrapper) to talk to the thermal printer and cash drawer.
- Cash drawer opens via the printer's RJ11 port using the standard ESC/POS kick command — **only works if the drawer is wired through the printer.**
- **This is a separate sub-task, not a one-line feature.** Treat printer + drawer setup as its own deliverable with its own testing time.

---

## 3. Technical Stack & Architecture

### Backend API
- **Framework:** Laravel (latest stable)
- **Database:** PostgreSQL
- **Structure:** Modular by domain (Inventory, Sales, Customers, Vendors) — clean separation, not heavyweight DDD ceremony.
- **API:** RESTful, versioned (`/api/v1/`). Stateless auth via Laravel Sanctum.

### Frontend (POS + Admin Panel)
- **Framework:** Next.js (App Router)
- **Structure:** Feature-based folders (`features/pos`, `features/inventory`, etc.)
- **UI:** Tailwind CSS. Keyboard-first, low-latency POS layout.
- **Offline:** POS billing flow must work offline with local queue + sync (see 2.1).

### Mobile App — **POST-MVP (not in this build)**
Flutter owner-dashboard app is **explicitly out of MVP scope.** Owner reports/Khata can be viewed via the responsive web admin on a phone browser. Mobile app is a Phase 2 deliverable, quoted separately. (Schema/API designed so it can attach later without rework.)

---

## 4. Core MVP Modules & Features

### 4.1. Inventory Management
- **Product master:** Name, Barcode/SKU (optional), Brand, Category, Cost Price (auto via moving average), Selling Price.
- **Fractional units:** Stock and sell in decimals (kg, grams, dozen, pieces) for loose goods — sugar, pulses, flour. Unit and decimal precision configurable per product.
- **Stock movement log:** Every batch-in, manual adjustment, and sale-out recorded with timestamp and user.
- **Low stock alerts:** Dashboard trigger when quantity falls below a per-product threshold.

### 4.2. POS Checkout Screen
- **Keyboard-first checkout:** Loose/unbarcoded items are the norm, so **fast keyboard search by name is the primary input** — barcode scanning is secondary, not assumed for every item.
- **Barcode scanner:** Instant add via USB/Bluetooth scanner for packaged goods.
- **Hold / suspend cart:** Park an active cart, serve another customer, resume — without losing data.
- **Payment methods:** Cash, Card, Mobile wallets / QR (JazzCash, Easypaisa, NayaPay, Raast), Khata (credit). Split/partial payment supported (e.g. part cash, part Khata).
- **Offline:** Full billing + receipt + stock deduction must work with no internet (see 2.1).

### 4.3. Khata / Udhaar (Customer Credit Ledger)
- **Customer profile:** Name, Phone, unique Customer ID.
- **Running balance:** Real-time outstanding credit per customer.
- **Invoice link:** Any unpaid/partially-paid POS ticket attaches to the customer's Khata.
- **Repayment log:** History of cash installments paid against balance, with date and amount.

### 4.4. Vendor & Purchase Management
- **Vendor master:** Wholesale distributors and local agents (Unilever, Nestlé, etc.).
- **Goods received / purchase entry:** Log incoming stock; auto-updates moving-average cost (see 2.3).
- **Vendor payables ledger:** Track amount owed, partial payments, outstanding balance per vendor.

### 4.5. Users, Roles & Security
- **RBAC:**
  - **Admin / Owner:** Full access — financial reports, P&L, cost prices, deletions, settings.
  - **Cashier:** Locked to POS checkout + basic daily summary only. No cost prices, no reports.
- **Manager PIN override:** Deleting a line item, editing price on the fly, or manual discount requires admin/manager PIN.

### 4.6. Financial Reports
- **Day-End (Galla / Till Closing):** Reconciled breakdown — cash on hand, wallet/QR totals, card totals, credit extended. Closes the daily till session.
- **Basic P&L:** `(Selling Price − Avg Cost) × Qty Sold` over a date range.
- **Top-selling items:** Volume ranking to guide purchasing.

### 4.7. Hardware Integration
*(See 2.4 — this is a non-trivial sub-task, not a one-liner.)*
- **Thermal receipt printing:** ESC/POS for standard 80mm (3-inch) thermal printers, via local print bridge.
- **Cash drawer kick:** Standard pulse through printer RJ11 port on bill completion.
- **Receipt must include:** Store name + contact, date/time, invoice no., cashier name, line items (name, qty, unit, rate, amount), subtotal, discount, total, payment method, amount tendered/change, Khata balance (if credit sale), and a footer note. *(Confirm exact fields with the owner before building.)*

---

## 5. Development Phases (MVP)

### Phase 1 — Database & Core APIs (Laravel)
- PostgreSQL schema with indices on barcode, product name, transaction timestamp.
- RBAC + Sanctum auth.
- CRUD APIs for Inventory, Vendors, Customers.
- Moving-average cost logic on goods-received.

### Phase 2 — Admin Panel & Inventory (Next.js)
- Auth views, secured dashboards.
- Inventory tables/forms: bulk add, categories, unit setup, thresholds.

### Phase 3 — POS Register (Next.js) **[highest-risk phase]**
- High-performance checkout with keyboard search + scanner support.
- Hold/resume multi-cart local state.
- **Offline billing + local queue + auto-sync.**
- Print bridge integration (thermal + drawer kick).
- Day-end till closing flow.

### Phase 4 — Khata, Vendor Ledger & Reports
- Customer Khata ledger + repayment logs.
- Vendor payables ledger.
- Day-end, P&L, top-items reports.

> **Post-MVP (separate quote):** Flutter owner mobile app, multi-store, advanced analytics, loyalty, etc.

---

## 6. Out of Scope (MVP) — Stated Explicitly
To prevent scope creep and timeline blowout, the following are **NOT** in the MVP:
- Flutter / native mobile app
- Multi-store / multi-branch
- FIFO/batch costing, expiry tracking
- Online ordering / e-commerce
- Loyalty points, promotions engine
- Advanced BI dashboards

Each can be added later without rebuilding the core, but is **not** quoted or built in this phase.
