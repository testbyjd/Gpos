# UX Trust Fixes (Non-technical users)

Yeh changes is liye kiye gaye ke user ko galat na lage ke data save ho gaya jab ke backend pe nahi hua — ya duplicate save na ho retry pe.

## Phase 1 — Core trust (6 items)

| # | Issue | Fix | Files |
|---|--------|-----|-------|
| 1 | Purchase scan toast misleading | Info toast: *List mein add — Post purchase dabao* + draft banner | `purchases/new/page.tsx` |
| 2 | Draft lost on refresh/back | `beforeunload` + Back confirm + draft `PageAlert` | `purchases/new/page.tsx` |
| 3 | Purchase duplicate on retry | `client_id` UUID idempotency | `PurchaseService.php`, migration, FE post |
| 4 | “Offline billing chalega” galat | POS + Settings: **online-only** | `PosRegister.tsx`, `settings/page.tsx` |
| 5 | Dashboard Rs 0 on load fail | Metrics hide; error banner only | `dashboard/page.tsx` |
| 6 | Checkout sirf browser online | `useBillingConnection()` — browser + API health | `connection-status.ts`, `PosRegister.tsx` |

## Phase 2 — Backlog (high / medium / low)

### High

| Issue | Fix | Files |
|--------|-----|-------|
| Payment modal accidental dismiss | No backdrop click; Escape off | `PaymentModal.tsx` |
| Stale POS prices at checkout | `syncCartWithCatalog()` before bill | `syncCartPrices.ts`, `PosRegister.tsx` |
| Reports Rs 0 on API fail | Hide metrics when loading/error | `reports/page.tsx` |
| Purchase partial payment unclear | `paidInput` + `clampPaidAmount()` | `payment-terms.ts`, `purchases/new/page.tsx` |

### Medium

| Issue | Fix | Files |
|--------|-----|-------|
| Held carts lost on refresh | localStorage `gpos.pos.heldCarts.v1` | `PosRegister.tsx` |
| Inventory import fake | Import disabled “soon”; Export CSV works | `inventory/page.tsx` |
| Error toast too short | 8s + dismiss X on errors | `app-toast.tsx` |
| 401 silent fail | Redirect `/login?expired=1` + banner | `api.ts`, `login/page.tsx` |
| Form modals accidental dismiss | No backdrop/Escape on save forms | `AdminActionModals`, drawers, settings |
| List load fail no retry | `PageLoadError` + Retry button | `AdminShell.tsx`, list pages |

### Low

| Issue | Fix | Files |
|--------|-----|-------|
| Sale success no print | Print button in success modal | `SaleSuccessModal.tsx` |
| Purchase post no feedback on list | `?posted=1` highlight + toast | `purchases/page.tsx`, `new/page.tsx` |
| Manual refresh missing | Refresh on purchases, khata, payables, vendors | list pages |
| Settings “Audit Enabled” misleading | “Activity log — Server-side” | `settings/page.tsx` |
| Deploy data loss risk | `docs/DEPLOY.md` — no `migrate:fresh` on prod | `docs/DEPLOY.md` |

## Deploy

See **`docs/DEPLOY.md`**.

```bash
cd backend && php artisan migrate --force
cd frontend && npm run build
```

## Staff training (short)

1. **Purchase:** Scan = draft. Stock tab jab **Post purchase** success ho.
2. **POS bill:** Sirf “Sale Completed” + invoice # = saved.
3. **Offline badge:** Checkout mat karo jab tak Online na ho.
4. **Red banner + Retry:** Server issue — Retry dabao, dubara save mat karo blindly.
