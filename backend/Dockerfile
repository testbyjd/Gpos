# ---- Laravel API image (FrankenPHP: one container, production-grade, concurrent) ----
# Build context must be the repo root: docker build -f backend/Dockerfile .

# 1) Install PHP dependencies with Composer
FROM composer:2 AS vendor
WORKDIR /app
COPY backend/composer.json backend/composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction
COPY backend/ ./
# Disable the strict platform_check.php: the composer image's PHP may differ
# from the 8.3 runtime. Package requirements (^8.2) are still enforced.
RUN composer config platform-check false \
 && composer dump-autoload --optimize --no-dev

# 2) Runtime
FROM dunglas/frankenphp:1-php8.3-alpine
# pdo_pgsql -> Postgres, bcmath -> money math (StockService bcadd/bcsub), opcache -> speed
RUN install-php-extensions pdo_pgsql bcmath opcache
WORKDIR /app
COPY --from=vendor /app /app
RUN chown -R www-data:www-data storage bootstrap/cache
# FrankenPHP serves /app/public on this address
ENV SERVER_NAME=:8000
EXPOSE 8000
COPY deploy/backend-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
