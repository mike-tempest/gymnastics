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

# Check if seed is needed
echo "[entrypoint] Checking if seed is needed..."
NEEDS_SEED=$(node -e "
const { Client } = require('/app/node_modules/pg');
const connStr = process.env.DATABASE_URL || 'postgres://' + process.env.DB_USER + ':' + process.env.DB_PASSWORD + '@' + process.env.DB_HOST + ':' + (process.env.DB_PORT || 5432) + '/' + process.env.DB_NAME;
const client = new Client({ connectionString: connStr });
client.connect()
  .then(() => client.query('SELECT COUNT(*) FROM users'))
  .then(res => { console.log(res.rows[0].count === '0' ? 'yes' : 'no'); return client.end(); })
  .catch(() => { console.log('yes'); client.end().catch(()=>{}); });
" 2>/dev/null || echo "yes")

if [ "$NEEDS_SEED" = "yes" ]; then
  echo "[entrypoint] Seeding demo data..."
  node dist/database/seeds/demo-seed.js 2>&1 || node dist/seed/demo-seed.js 2>&1 || echo "[entrypoint] Seed not found, skipping."
else
  echo "[entrypoint] Database already has data, skipping seed."
fi

echo "[entrypoint] Starting application..."
exec node dist/main.js
