# Print Bridge — Local Hardware Agent

Browser raw ESC/POS / drawer-kick direct nahi bhej sakta. Har register PC pe yeh agent chalao.

## Run

```bash
cd print-bridge
node server.js
```

Default: `http://127.0.0.1:9191`

| Endpoint | Action |
|----------|--------|
| `GET /health` | Bridge alive? |
| `POST /drawer` | Cash drawer open (ESC/POS pulse via printer) |

## Config (`config.json`)

- `listenPort` — bridge HTTP (default **9191**)
- `printerHost` / `printerPort` — thermal printer raw TCP (aksar **9100**)
- Drawer RJ11 se printer pe wired hona zaroori hai

## POS

Sale complete pe frontend `POST /drawer` call karta hai. Receipt print alag **Print** button se (browser receipt).
