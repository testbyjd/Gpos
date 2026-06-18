# Print Bridge — Local Hardware Agent

Browser raw ESC/POS bytes ya drawer-kick pulse direct nahi bhej sakta (plan §2.4).
Ye chhota local agent har register PC par chalta hai aur thermal printer + cash drawer
ko handle karta hai.

> **Yeh ek alag deliverable hai, one-line feature nahi.** Apni testing time ke saath.

## Responsibility
- **Thermal print**: 80mm (3-inch) ESC/POS receipts.
- **Cash drawer kick**: standard pulse printer ke RJ11 port se (drawer printer ke through wired ho tabhi chalega).
- Frontend se localhost par receipt payload accept karna (HTTP/WebSocket).

## Structure
```
src/
├── printer/     # ESC/POS command builder + transport (USB/serial/network)
├── drawer/      # kick command via printer RJ11
└── queue/       # local job queue (retry on transient printer errors)
config/          # printer model, port, paper width, receipt fields
```

## Receipt fields (confirm with owner — plan §4.7)
Store name+contact, date/time, invoice no., cashier, line items (name/qty/unit/rate/amount),
subtotal, discount, total, payment method, tendered/change, Khata balance (if credit), footer note.

## Implementation options (developer's choice)
- QZ Tray, a small Node/Electron local agent, ya native wrapper.
- The **requirement** fixed hai; the **method** open hai.
