# ADR 05 — Offline billing & sync protocol

**Status:** Locked  
**Plan ref:** §2.1, Phase 3

## Context

Internet unreliable hai. POS billing **kabhi** internet ke bina rukni nahi chahiye. Admin/inventory online-only acceptable hai.

## Decision

### Client (POS register)
1. **Write-local-first:** Sale create → IndexedDB mein save → receipt print → stock locally deduct.
2. **Outbox queue:** Har mutation ek queue item ban jati hai (`pending` → `syncing` → `synced` | `failed`).
3. **Auto-replay:** `online` event pe queue FIFO order mein server ko bheji jati hai.
4. **Catalog cache:** Products/customers read-only cache; reconnect pe `pull` se refresh.

### Server (Laravel API)
1. **Idempotent creates:** Har offline sale ke paas client-generated `client_id` (UUID v4). Duplicate POST same `client_id` → **200 + existing record** (no double sale).
2. **Push endpoint:** `POST /api/v1/sync/push` — batch of sales (max 50 per request).
3. **Pull endpoint:** `GET /api/v1/sync/pull?since={iso8601}` — products, customers, categories changed since timestamp.
4. **Server wins on conflict:** Stock conflicts resolved server-side; client gets corrected stock in pull response.
5. **Audit:** `sync_log` table records every push attempt (device_id, client_id, status).

### Fields on syncable entities
| Table   | Required for sync      |
|---------|------------------------|
| `sales` | `client_id` UUID UNIQUE, `device_id`, `synced_at` |
| Others  | standard `updated_at` for pull |

### Not synced offline (online-only)
- Purchases / GRN entry
- Reports, settings, user management
- Till close (can queue later; MVP: online preferred)

## Consequences
- Frontend needs IndexedDB layer (`features/pos/sync/`) — Phase 3.
- Every sale API must accept optional `client_id` even when online (same code path).
- Tests must cover duplicate push = no double stock deduction.
