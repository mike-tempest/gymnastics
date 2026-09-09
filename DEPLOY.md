# Deploy the gymnastics platform on Railway

Work is tracked in TEM-16. Use only the private [Gymnastics project](https://railway.com/project/dd7721ab-fcc4-4de9-8518-2eee17bc0f34). Its production environment and empty `membership` and `web` services were created on 9 September 2026. Databases, provider accounts, domains and deployed smoke tests are still outstanding. Nothing is shared with the original swimming platform.

## Connect the services

Connect `mike-tempest/gymnastics`, branch `main`, to each existing service through the Railway dashboard. Keep the repository root as the build context so workspace packages are available.

Set these values directly in each service's settings:

| Setting              | membership                            | web                           |
| -------------------- | ------------------------------------- | ----------------------------- |
| Builder              | Dockerfile                            | Dockerfile                    |
| Dockerfile path      | `services/membership/Dockerfile.prod` | `apps/web/Dockerfile`         |
| Root directory       | `/`                                   | `/`                           |
| Port                 | `3001`                                | `3000`                        |
| Health check         | `/health`                             | `/`                           |
| Health check timeout | `300` seconds                         | `300` seconds                 |
| Restart policy       | On failure, maximum 3 retries         | On failure, maximum 3 retries |

The old config files have been removed. Railway's [current configuration guidance](https://docs.railway.com/config-as-code) says new services cannot opt into legacy `railway.json` / `railway.toml` configuration. Use dashboard settings for this initial setup; a future infrastructure-as-code change can capture the complete project after its resources are verified.

Do not use the generic root Dockerfile or `services/membership/entrypoint.sh` for this deployment. The production membership image starts the compiled application directly. It defaults to `TYPEORM_MIGRATIONS_RUN=true` and `TYPEORM_SYNCHRONIZE=false`: versioned migrations run before the application serves requests, and failed migrations prevent startup. No demo accounts are created automatically.

## Data and secrets

Create PostgreSQL and Redis inside this project using Railway's database templates, with persistent volumes and backups. Keep their endpoints private. Do not copy an existing project's variables or connect the application before its own database is ready.

Set membership variables using references to those new services:

| Variable                                                                 | Value                                                      |
| ------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `NODE_ENV`                                                               | `production`                                               |
| `PORT`                                                                   | `3001`                                                     |
| `DB_HOST`, `DB_PORT`                                                     | New PostgreSQL private host and port                       |
| `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`                              | New PostgreSQL credentials and database                    |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`                             | New Redis private connection values                        |
| `JWT_SECRET`                                                             | Fresh random secret, at least 32 characters                |
| `APP_URL`, `CORS_ORIGINS`                                                | Exact public web origin                                    |
| `API_URL`                                                                | Public API origin                                          |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM` | The gymnastics platform's mail service and verified sender |
| `GOCARDLESS_ENVIRONMENT`                                                 | `sandbox` until payment testing is complete                |
| `ENABLE_COMPETITIONS`                                                    | `false`                                                    |

The API reads `DB_USERNAME` and `DB_DATABASE`, not `DB_USER` or `DB_NAME`. A standalone `DATABASE_URL` does not satisfy its configuration validation. Keep schema synchronisation disabled and do not set `SEED_DEMO_CLUB` on the running production service.

Set web variables:

| Variable              | Value                                                                         |
| --------------------- | ----------------------------------------------------------------------------- |
| `NODE_ENV`, `PORT`    | `production`, `3000`                                                          |
| `NEXTAUTH_SECRET`     | Fresh random secret                                                           |
| `NEXTAUTH_URL`        | Exact public web origin                                                       |
| `NEXT_PUBLIC_API_URL` | Public API URL **including `/api`**, supplied at build time                   |
| `MEMBERSHIP_API_URL`  | API origin or base URL reachable from the web service for server-side sign-in |

Changing `NEXT_PUBLIC_API_URL` requires rebuilding the web image because Next.js includes it in the browser bundle. Generate Railway service domains first if the final product domain has not been decided. Do not invent a product name or buy a domain without the naming decision in TEM-5.

Mike owns creation of the separate GoCardless sandbox organisation and Stripe account. Connect GoCardless through the club's own organisation and configure its webhook secret using the existing provider setup. Never enable `LEGACY_GOCARDLESS_ENV_FALLBACK` in production. Configure Stripe test credentials and webhooks only for the separate account. A healthy API response with `gocardless.notConfigured=true` is not evidence that Direct Debit works.

## Verify the deployment (TEM-17)

1. Confirm both deployed services use the intended commit and answer their health checks. Check `/health` reports the database as up.
2. Confirm the database starts without demo users and migrations have completed.
3. For demo seeding, use a separate non-production environment in this project with explicit database settings. Follow [the demo guide](docs/demos/gym-demo-club.md). The seed rejects `NODE_ENV=production`; never change that guard. Do not run it against a real club's database.
4. Exercise sign-in as admin, Welfare Officer, coach and parent. Check staff attribution for DBS and credentials, gymnast/family/squad/session/attendance flows, billing and the parent dashboard.
5. Exercise waiting-list enrolment and an actual sandbox Direct Debit flow. Seeded mandate rows are fixtures, not proof of a successful provider connection. Verify the sandbox webhook round trip separately.
6. Record deployment URLs, commit, test results and outstanding failures in TEM-16/TEM-17. Keep TEM-17 open until the deployed checks pass.

## Local image validation

Run from the repository root:

```sh
docker build -f services/membership/Dockerfile.prod -t gymnastics-membership:local .
docker build -f apps/web/Dockerfile -t gymnastics-web:local \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:3001/api .
```

The production-image CI workflow builds both images on Linux. Runtime checks must use a disposable local database with explicit `DB_*` values, never the repository's saved environment file.
