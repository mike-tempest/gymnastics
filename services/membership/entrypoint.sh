#!/bin/sh
set -e

cd /app/services/membership

# Run TypeORM migrations using the compiled datasource config
echo "[entrypoint] Running database migrations..."
node -e "
const { DataSource } = require('/app/node_modules/typeorm');
const path = require('path');

const ds = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  host: process.env.DATABASE_URL ? undefined : process.env.DB_HOST,
  port: process.env.DATABASE_URL ? undefined : parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DATABASE_URL ? undefined : process.env.DB_USER,
  password: process.env.DATABASE_URL ? undefined : process.env.DB_PASSWORD,
  database: process.env.DATABASE_URL ? undefined : process.env.DB_NAME,
  entities: [path.join(__dirname, 'dist/**/*.entity.js')],
  synchronize: true,
  logging: false,
});

ds.initialize()
  .then(() => { console.log('[entrypoint] Schema sync complete'); return ds.destroy(); })
  .then(() => process.exit(0))
  .catch(err => { console.error('[entrypoint] Schema sync failed:', err.message); process.exit(1); });
" || { echo "[entrypoint] Schema sync failed, continuing anyway..."; }

# Demo seed. Off unless SEED_DEMO_CLUB is the exact string 'true'.
#
# This used to seed whenever the users table was empty, which meant any
# environment that came up against a fresh database quietly gained a demo
# club. Seeding a deployment is a decision someone makes, so it now takes an
# explicit flag, and a failure stops the container rather than being swallowed.
#
# The seed is idempotent: it clears its own club and rebuilds, and it touches
# no other tenant.
if [ "${SEED_DEMO_CLUB:-}" = "true" ]; then
  echo "[entrypoint] SEED_DEMO_CLUB=true, seeding the demo gymnastics club..."
  node dist/seed/gym-demo-seed.js
else
  echo "[entrypoint] SEED_DEMO_CLUB not set, skipping seed."
fi

echo "[entrypoint] Starting application..."
exec node dist/main.js
