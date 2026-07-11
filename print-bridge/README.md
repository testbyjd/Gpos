# Print Bridge — Local Hardware Agent

Browser raw ESC/POS / drawer-kick direct nahi bhej sakta.  
POS website (`https://gondaltrader.com/pos`) **server** pe chalti hai, lekin **print-bridge har store register PC pe local** chalta hai.

```
Store PC browser → gondaltrader.com/pos     (internet / server)
               → http://127.0.0.1:9191      (isi PC pe print-bridge)
                    → thermal printer :9100
                         → cash drawer (RJ11 via printer)
```

Server (VPS) pe print-bridge **nahi** chalana.

---

## Windows setup (store PC)

### 1) Node.js install

1. [https://nodejs.org](https://nodejs.org) se **LTS** download karo  
2. Installer chalao (default options theek hain)  
3. CMD / PowerShell khol ke check:

```bat
node -v
```

Version dikhna chahiye (e.g. `v22.x.x`).

### 2) Folder copy

Is repo ka `print-bridge` folder Windows pe copy karo, e.g.:

```text
C:\gpos\print-bridge\
  server.js
  config.json
  README.md
```

Minimum zaroori: `server.js` + `config.json`.

### 3) Printer config

`config.json` edit karo (Notepad):

```json
{
  "listenHost": "127.0.0.1",
  "listenPort": 9191,
  "printerHost": "192.168.1.50",
  "printerPort": 9100,
  "drawerPin": 0,
  "drawerOnMs": 25,
  "drawerOffMs": 250
}
```

| Field | Matlab |
|-------|--------|
| `printerHost` | Is counter ki thermal printer ka LAN IP (USB-only printers ke liye aksar printer software / raw TCP enable karna padta hai) |
| `printerPort` | Raw print port — aksar **9100** |
| `listenPort` | Bridge HTTP — default **9191** (POS isi pe call karti hai) |
| Drawer | RJ11 cable **printer** pe lagi honi chahiye |

`printerHost` ko `127.0.0.1` mat chhoro jab tak printer isi PC pe raw TCP se na sun raha ho.

### 4) Bridge chalao

CMD / PowerShell:

```bat
cd C:\gpos\print-bridge
node server.js
```

Success pe kuch aisa dikhe:

```text
[gpos-print-bridge] listening http://127.0.0.1:9191
[gpos-print-bridge] printer 192.168.1.50:9100
```

**Yeh window band mat karo** jab tak POS use ho — band hua to drawer nahi khulega.

POS browser: `https://gondaltrader.com/pos` (alag tab / Chrome).  
Sale complete → drawer isi local bridge se open hota hai.  
Receipt → alag **Print** button (browser print).

### 5) Test

Browser mein kholo: [http://127.0.0.1:9191/health](http://127.0.0.1:9191/health)

JSON mein `"ok": true` aana chahiye.  
GPOS **Settings → Print bridge** pe bhi **Ready** dikhna chahiye (jab yeh PC pe POS khula ho).

---

## Windows pe auto-start (optional)

Har reboot pe manually `node server.js` na chalana ho to:

### Option A — Startup folder (simple)

1. `Win + R` → `shell:startup` → Enter  
2. Shortcut banao:

```bat
C:\Program Files\nodejs\node.exe C:\gpos\print-bridge\server.js
```

(Node ka exact path apne PC pe `where node` se confirm karo.)

### Option B — Task Scheduler

1. Task Scheduler → Create Basic Task  
2. Trigger: **At log on**  
3. Action: Start a program  
   - Program: `node.exe` full path  
   - Arguments: `C:\gpos\print-bridge\server.js`  
   - Start in: `C:\gpos\print-bridge`

---

## 2 store PCs (2 counters)

Har counter PC pe **alag** print-bridge chalao:

| PC | Bridge | `printerHost` |
|----|--------|----------------|
| Counter 1 | `node server.js` on PC-1 | Printer-1 IP |
| Counter 2 | `node server.js` on PC-2 | Printer-2 IP |

- Dono same website use karenge: `https://gondaltrader.com/pos`  
- PC-1 ka bridge sirf PC-1 ke browser se `127.0.0.1:9191` pe reachable hai  
- Best practice: **1 counter = 1 printer + 1 drawer + 1 bridge**

---

## API (local)

Default: `http://127.0.0.1:9191`

| Endpoint | Action |
|----------|--------|
| `GET /health` | Bridge alive? |
| `POST /drawer` | Cash drawer open (ESC/POS pulse via printer) |

---

## Troubleshooting

| Problem | Check |
|---------|--------|
| Browser mein `127.0.0.1:9191/health` OK, lekin Settings pe **Offline** | POS `https://gondaltrader.com` se chalti hai — Chrome HTTPS → localhost block / permission maangta hai. Settings pe **Test drawer** dabao; agar prompt aaye to **Allow**. Bridge restart: naya `server.js` (PNA headers). DevTools → Console mein CORS / Private Network error? |
| POS: *Print bridge offline* | Is PC pe `node server.js` chal raha hai? Health URL open hoti hai? |
| Bridge OK, drawer nahi khulta | `printerHost` sahi? Printer raw **9100** sun raha? Drawer RJ11 printer pe? |
| Galat counter ka drawer | Har PC ki apni `config.json` / apna bridge |
| Port busy | Koi aur app `9191` use to nahi kar rahi |

### Chrome permission (important)

Address bar pe seedha `http://127.0.0.1:9191` open karna alag baat hai — yeh Settings wala fetch nahi.  
`gondaltrader.com` pe Settings / sale pe pehli dafa Chrome puch sakta hai: **local network / loopback** allow? → **Allow** choose karo.

Agar pehle Deny kar diya: site settings → Local network / Insecure content → Allow, ya site data clear karke dobara try.

Linux / Mac pe bhi same: folder mein `node server.js`.
