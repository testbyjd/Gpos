# GPOS Deployment — single VPS

One VPS runs the whole stack. Registers and the owner reach it over the
internet.

```
caddy :80/:443 ── /api → backend (Laravel/FrankenPHP)
               └─ /    → frontend (Next.js)
backend → postgres
```

> **Note:** VPS-only means billing needs internet — if the shop's connection
> drops, the registers cannot reach the server. (The POS still queues a sale in
> the browser tab while it is open, but a reload/restart needs connectivity.)

## Setup

1. Install Docker + Docker Compose on the VPS, then:
   ```sh
   cd deploy
   cp .env.example .env
   ```
2. Set a strong `DB_PASSWORD` and your `APP_URL` (domain or `http://<vps-ip>`).
3. Generate the app key and paste it into `.env` as `APP_KEY`:
   ```sh
   docker compose run --rm backend php artisan key:generate --show
   ```
4. (HTTPS) If you have a domain, edit `Caddyfile`: replace `:80` with your
   domain (e.g. `pos.example.com`) — Caddy auto-provisions a TLS cert. Make sure
   ports 80/443 are open and DNS points at the VPS.
5. Start everything:
   ```sh
   docker compose up -d --build
   ```
6. Seed the first store + users (one time):
   ```sh
   docker compose exec backend php artisan db:seed --class=GposSeeder --force
   ```
7. Open `http(s)://<your-domain-or-ip>/`.

## Operations

```sh
# logs
docker compose logs -f backend

# update to new code
git pull && docker compose up -d --build

# manual DB backup (run on a schedule via host cron for safety)
docker compose exec -T postgres pg_dump -Fc -U gpos gpos > gpos-$(date +%F).dump

# restore a dump
cat gpos-YYYY-MM-DD.dump | docker compose exec -T postgres \
  pg_restore --clean --if-exists --no-owner -U gpos -d gpos
```

## Notes
- `frontend` and `backend` share one origin via Caddy, so there is no CORS and
  no server IP baked into the browser bundle.
- Take regular DB backups (the `pg_dump` above) — there is no second copy in
  this setup.
