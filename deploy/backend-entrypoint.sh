#!/bin/sh
# Wait for Postgres, run migrations, then hand off to FrankenPHP.
set -eu

n=0
until php artisan migrate --force 2>/dev/null; do
  n=$((n + 1))
  if [ "$n" -ge 30 ]; then
    echo "[entrypoint] database not reachable after 30 tries — aborting" >&2
    exit 1
  fi
  echo "[entrypoint] waiting for database... ($n)"
  sleep 2
done

# Cache config for speed. Routes are NOT cached (health route uses a closure).
php artisan config:cache || true

echo "[entrypoint] starting FrankenPHP on :8000"
exec frankenphp run --config /etc/frankenphp/Caddyfile --adapter caddyfile
