# Swimly Deployment Guide (Railway)

This guide covers deploying Swimly to Railway for both staging and production environments. The stack is a pnpm monorepo with a NestJS membership service and a Next.js web application, backed by PostgreSQL.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Architecture Overview](#2-architecture-overview)
3. [First-time Project Setup](#3-first-time-project-setup)
4. [Environment Variables](#4-environment-variables)
5. [Database Setup (PostgreSQL Plugin)](#5-database-setup-postgresql-plugin)
6. [Deploying the Services](#6-deploying-the-services)
7. [Custom Domain Setup for swimly.uk](#7-custom-domain-setup-for-swimlyuk)
8. [Staging vs Production](#8-staging-vs-production)
9. [Common Troubleshooting](#9-common-troubleshooting)

---

## 1. Prerequisites

### Install the Railway CLI

```bash
# Via npm (recommended)
npm install -g @railway/cli

# Or via Homebrew on macOS
brew install railway
```

Verify the installation:

```bash
railway --version
```

### Authenticate

```bash
railway login
```

This opens a browser window. Log in with your Railway account (or create one at railway.com).

### Other tools required

| Tool | Minimum version | Purpose |
|------|----------------|---------|
| Node.js | 20 LTS | Local builds and scripts |
| pnpm | 8.15+ | Monorepo package manager |
| Docker | Any recent | Local image builds (optional) |
| Git | Any | Source control |

---

## 2. Architecture Overview

Swimly is deployed as three Railway services within a single project, backed by a Railway-managed PostgreSQL database:

| Service | Description | Port | Dockerfile |
|---------|-------------|------|------------|
| `web` | Next.js frontend | 3000 | `apps/web/Dockerfile` |
| `membership` | NestJS membership API | 3001 | `services/membership/Dockerfile.prod` |
| `postgres` | PostgreSQL database | 5432 | Railway Plugin (managed) |

The `notifications` service exists in the repository as a template store but has no deployable source code yet. It is excluded from the Railway deployment.

### Railway service config files

Each service has a `railway.toml` that tells Railway which Dockerfile to use and how to health-check the running container:

- `apps/web/railway.toml` - web service config
- `services/membership/railway.toml` - membership service config

The root `railway.json` defines the project-level schema version.

---

## 3. First-time Project Setup

### Create a Railway project

1. Go to [railway.com](https://railway.com) and create a new project.
2. Name it `swimly` (or `swimly-staging` for staging).

### Link the repository

1. Inside the Railway project, click **New Service** and choose **GitHub Repo**.
2. Select the `swim-team` repository.
3. Railway will auto-detect the monorepo. You will create one service per deployable component.

### Add the web service

1. In the Railway project, add a GitHub service.
2. Set **Root Directory** to `/` (repo root).
3. Railway will use `apps/web/railway.toml` to find the Dockerfile.
4. Name this service `web`.

### Add the membership service

1. Add another GitHub service from the same repo.
2. Set **Root Directory** to `/`.
3. Railway will use `services/membership/railway.toml` to find the Dockerfile.
4. Name this service `membership`.

### Add the PostgreSQL database

1. Click **New Service** and choose **Database**, then **PostgreSQL**.
2. Railway provisions a managed PostgreSQL instance and exposes `DATABASE_URL` automatically.

---

## 4. Environment Variables

Set variables in the Railway dashboard under each service's **Variables** tab. Never commit real secrets.

### Membership service variables

| Variable | Required | Description | How to generate |
|----------|----------|-------------|----------------|
| `DATABASE_URL` | Yes | Railway PostgreSQL connection string | Set automatically when you link the PostgreSQL plugin |
| `NODE_ENV` | Yes | Set to `production` | - |
| `PORT` | Yes | Set to `3001` | - |
| `JWT_SECRET` | Yes | Signs authentication tokens | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_EXPIRES_IN` | Yes | Token expiry, e.g. `24h` | - |
| `CORS_ORIGINS` | Yes | Comma-separated list of allowed frontend origins | e.g. `https://swimly.uk,https://www.swimly.uk` |
| `EMAIL_HOST` | No | SMTP hostname | Your SMTP provider |
| `EMAIL_PORT` | No | SMTP port | Usually `587` |
| `EMAIL_USER` | No | SMTP username | Your SMTP provider |
| `EMAIL_PASSWORD` | No | SMTP password | Your SMTP provider |
| `EMAIL_FROM` | No | Sender address | e.g. `noreply@swimly.uk` |
| `GOCARDLESS_ACCESS_TOKEN` | No | GoCardless API key | GoCardless dashboard |
| `GOCARDLESS_ENVIRONMENT` | No | `sandbox` or `live` | - |
| `GOCARDLESS_WEBHOOK_SECRET` | No | Verifies GoCardless webhooks | GoCardless dashboard |
| `LOG_LEVEL` | No | `warn` for production | - |

### Web service variables

| Variable | Required | Description | Notes |
|----------|----------|-------------|-------|
| `NODE_ENV` | Yes | Set to `production` | - |
| `NEXTAUTH_URL` | Yes | Public URL of the web app | e.g. `https://swimly.uk` |
| `NEXTAUTH_SECRET` | Yes | NextAuth session secret | `openssl rand -base64 32` |
| `NEXT_PUBLIC_API_URL` | Yes | Public URL of the membership API | e.g. `https://membership.swimly.uk` or the Railway-generated URL |
| `MEMBERSHIP_API_URL` | Yes | Private server-side URL of the membership API | Use Railway private networking: `http://membership.railway.internal:3001` |

> **Note on `NEXT_PUBLIC_API_URL` vs `MEMBERSHIP_API_URL`:** The `NEXT_PUBLIC_` prefix makes a variable available in the browser bundle at build time. Use `MEMBERSHIP_API_URL` for server-side calls (e.g. NextAuth) so they go over Railway's private network rather than the public internet.

### Linking services via Railway reference variables

Railway allows services to reference each other's variables using `${{ServiceName.VARIABLE_NAME}}` syntax. In the Railway dashboard you can set:

```
# On the web service
MEMBERSHIP_API_URL = ${{membership.RAILWAY_PRIVATE_DOMAIN}}
```

This automatically fills in the private hostname of the membership service.

---

## 5. Database Setup (PostgreSQL Plugin)

### Provision the database

1. In the Railway project, click **New Service** and choose **Database**, then **PostgreSQL**.
2. Railway creates a managed PostgreSQL instance and sets `DATABASE_URL` on it automatically.
3. In the membership service Variables tab, add a reference variable:
   ```
   DATABASE_URL = ${{Postgres.DATABASE_URL}}
   ```

### Run database migrations

After the first deployment, run migrations via the Railway CLI:

```bash
# Open a shell inside the running membership service
railway run --service membership node services/membership/dist/migration-runner.js
```

Alternatively, connect via the Railway database proxy:

```bash
# Start a local proxy to the Railway PostgreSQL instance
railway connect --service postgres

# In another terminal, run migrations pointing at the proxy
cd services/membership
DATABASE_URL="postgresql://..." pnpm db:migrate
```

### Seed demo data (optional)

```bash
railway run --service membership node services/membership/dist/scripts/seed-demo.js
```

---

## 6. Deploying the Services

### Automatic deploys (recommended)

Railway deploys automatically whenever you push to the connected GitHub branch. No manual steps are needed after initial setup.

1. Push your changes to the connected branch (e.g. `main`).
2. Railway detects the push and triggers a build for each linked service.
3. Builds run in parallel. Railway routes traffic to the new instances only after health checks pass.

### Manual deploy via CLI

```bash
# Deploy all services in the current project
railway up

# Deploy a specific service
railway up --service web
railway up --service membership
```

### Verify the deployment

```bash
# Tail logs for the membership service
railway logs --service membership

# Tail logs for the web service
railway logs --service web

# Check service status
railway status
```

Expected health check response for membership:

```bash
curl https://<your-membership-url>/api/health
# {"status":"ok"}
```

---

## 7. Custom Domain Setup for swimly.uk

### Add the domain in Railway

1. In the Railway dashboard, open the `web` service.
2. Go to **Settings** and find the **Domains** section.
3. Click **Custom Domain** and enter `swimly.uk`.
4. Repeat for `www.swimly.uk`.

For the membership API, add `api.swimly.uk` (optional but recommended for production).

### Configure DNS at your registrar

Railway will display the DNS records to add. Typically:

**Apex domain (swimly.uk):**

| Type | Name | Value |
|------|------|-------|
| `CNAME` | `@` | Provided by Railway |

> Some registrars do not support CNAME on the apex. In that case, use Railway's IP addresses with `A` records.

**www subdomain:**

| Type | Name | Value |
|------|------|-------|
| `CNAME` | `www` | Provided by Railway |

**API subdomain (optional):**

| Type | Name | Value |
|------|------|-------|
| `CNAME` | `api` | Membership service Railway URL |

Railway provisions TLS certificates via Let's Encrypt automatically once DNS resolves.

### Update environment variables after DNS is live

```bash
# Update NEXTAUTH_URL on the web service
railway variables set NEXTAUTH_URL=https://swimly.uk --service web

# Update CORS_ORIGINS on the membership service
railway variables set CORS_ORIGINS=https://swimly.uk,https://www.swimly.uk --service membership
```

---

## 8. Staging vs Production

Use separate Railway projects for staging and production.

| Setting | Staging | Production |
|---------|---------|-----------|
| Project name | `swimly-staging` | `swimly` |
| Branch | `develop` or `staging` | `main` |
| `GOCARDLESS_ENVIRONMENT` | `sandbox` | `live` |
| `NEXTAUTH_URL` | Railway-generated URL | `https://swimly.uk` |
| `CORS_ORIGINS` | Railway-generated web URL | `https://swimly.uk,https://www.swimly.uk` |
| Database | Separate Railway PostgreSQL instance | Separate Railway PostgreSQL instance |
| Secrets | Test values | Production-grade values only |

### Create a staging project

1. Create a new Railway project named `swimly-staging`.
2. Connect the same GitHub repo but point to your staging branch.
3. Add the same services and repeat the variable setup with staging values.

---

## 9. Common Troubleshooting

### Build fails: "Cannot find module '@club-manager/shared-types'"

The Dockerfiles copy shared packages before the service source. Verify the `packages/` directory is not excluded by `.dockerignore`.

```bash
cat .dockerignore | grep packages
```

### Health check fails after deploy

Railway only routes traffic after health checks pass. If the membership service fails its health check at `/api/health`, check the logs:

```bash
railway logs --service membership
```

Common causes:
- `DATABASE_URL` not set or incorrect (check Variables tab in Railway dashboard)
- Migrations have not been run yet (run them after first deploy)
- The container is still starting (the health check timeout is 300 seconds)

### "Invalid JWT" or authentication errors

Ensure `NEXTAUTH_SECRET` is the same value on both services:

```bash
railway variables --service web
railway variables --service membership
```

If they differ, update the web service to match the membership service value.

### CORS errors in the browser

The `CORS_ORIGINS` variable on the membership service must include the exact origin the browser is sending (protocol + host + port):

```bash
railway variables set CORS_ORIGINS=https://swimly.uk,https://www.swimly.uk --service membership
```

### Next.js can reach the API on the server but not in the browser

This is usually a misconfiguration of `NEXT_PUBLIC_API_URL` vs `MEMBERSHIP_API_URL`:

- `MEMBERSHIP_API_URL` is used by the Next.js server (e.g. NextAuth) and should point to the Railway private network address.
- `NEXT_PUBLIC_API_URL` is used by the browser and must be a public HTTPS URL.

Make sure both are set correctly in the Railway web service Variables tab.

### Deployment stuck in "Building" state

Check the build logs in the Railway dashboard for errors. Common causes:
- Docker build layer cache issue (trigger a fresh build by clicking **Redeploy** with cache cleared)
- pnpm lockfile mismatch (run `pnpm install` locally and commit the updated `pnpm-lock.yaml`)

### Rolling back a bad deploy

In the Railway dashboard, navigate to the service, open **Deployments**, and click **Rollback** on any previous successful deployment.

---

## Quick Reference

```bash
# Log in to Railway
railway login

# Link to an existing project
railway link

# Deploy all services
railway up

# Deploy a specific service
railway up --service membership

# Tail logs
railway logs --service membership
railway logs --service web

# Run a command inside a service
railway run --service membership node services/membership/dist/migration-runner.js

# Set a variable
railway variables set KEY=value --service membership

# Open the Railway dashboard
railway open
```

---

## Further Reading

- [Railway documentation](https://docs.railway.com)
- [Railway monorepo guide](https://docs.railway.com/guides/monorepo)
- [Railway environment variables](https://docs.railway.com/guides/variables)
- [Railway private networking](https://docs.railway.com/guides/private-networking)
- [NestJS production deployment](https://docs.nestjs.com/faq/serverless)
- [Next.js standalone output](https://nextjs.org/docs/app/api-reference/next-config-js/output)
