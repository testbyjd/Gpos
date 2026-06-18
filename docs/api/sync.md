# Sync API contract (`/api/v1/sync`)

Offline POS ke liye. Auth: `Bearer` Sanctum token.

## Push sales (idempotent)

`POST /api/v1/sync/push`

```json
{
  "device_id": "register-1",
  "sales": [
    {
      "client_id": "550e8400-e29b-41d4-a716-446655440000",
      "sold_at": "2026-06-18T14:32:00+05:00",
      "cashier_id": 1,
      "customer_id": null,
      "subtotal": 3520,
      "discount": 0,
      "total": 3520,
      "lines": [
        {
          "product_id": 12,
          "qty": 2.5,
          "unit_price": 165,
          "line_total": 412.5
        }
      ],
      "payments": [
        { "method": "cash", "amount": 4000, "tendered": 4000, "change": 480 }
      ]
    }
  ]
}
```

**Response 200:**

```json
{
  "results": [
    {
      "client_id": "550e8400-e29b-41d4-a716-446655440000",
      "status": "created",
      "server_id": 1048,
      "invoice_no": "INV-1048"
    }
  ],
  "server_time": "2026-06-18T19:45:00+05:00"
}
```

Duplicate `client_id` → `status: "already_synced"`, same `server_id`.

**Errors:** `422` validation, `409` stock insufficient (sale rejected; client marks `failed` + alert).

## Pull catalog changes

`GET /api/v1/sync/pull?since=2026-06-18T00:00:00Z`

```json
{
  "server_time": "2026-06-18T19:45:00Z",
  "products": [ /* changed since `since` */ ],
  "customers": [ /* khata customers */ ],
  "categories": [ ]
}
```

## Health (for ConnectionStatus)

`GET /api/v1/health` → `{ "ok": true, "time": "..." }` (no auth).
