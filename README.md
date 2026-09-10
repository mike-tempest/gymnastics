# Tumblebase

> Modern swim club management software built specifically for British swim clubs

Tumblebase brings enrolment, Direct Debit billing, attendance, awards and compliance together for gymnastics clubs. The registered product domain is **tumblebase.com**.

## Overview

Built for British Gymnastics-affiliated clubs, Tumblebase works alongside My BG. It supports waiting-list offers, family records, GoCardless in each club's own organisation, staff credential expiry tracking and full club data export.

The platform combines a powerful web-based admin dashboard with a mobile-friendly parent portal, giving clubs and families the tools they need to stay organised and connected.

## Tech Stack

### Frontend

- **Next.js 14** with App Router and React Server Components
- **TypeScript 5.3+** for type safety
- **Tailwind CSS** for styling
- **shadcn/ui** component library
- **TanStack Query** for data fetching and caching

### Backend

- **NestJS** microservices architecture
- **PostgreSQL 16** for data persistence
- **Redis 7** for caching and sessions
- **Kong Gateway** for API management
- **TypeORM** for database access

### Payments & Billing

- **GoCardless** for Direct Debit (primary)
- **Stripe** for card payments (secondary)

### Infrastructure

- **Docker & Docker Compose** for local development
- **Turborepo** for monorepo management
- **pnpm** for package management

## Quick Start

### Prerequisites

Ensure you have the following installed:

- **Node.js 20+ LTS** (verify with `node --version`)
- **pnpm 8.15+** (verify with `pnpm --version`; install with `corepack enable && corepack prepare pnpm@8.15.0 --activate`)
- **Docker 24+** with Docker Compose (verify with `docker --version`)

### Docker Quick Start (Recommended)

The fastest way to get Swimly running locally:

```bash
# Clone the repository
git clone https://github.com/your-org/swimly.git
cd swimly

# Copy environment variables
cp .env.example .env
# Edit .env if needed (defaults work for local development)

# Start all services with Docker Compose
docker compose up

# In a new terminal, run database migrations
docker compose exec membership pnpm db:migrate

# (Optional) Seed initial data
docker compose exec membership pnpm seed:demo:gym
```

That's it! The following services will be available:

- **Web App**: http://localhost:3000
- **Membership API**: http://localhost:3001
- **Notifications API**: http://localhost:3005
- **PostgreSQL**: localhost:5432

To stop all services: `docker compose down`

### Manual Installation (Alternative)

If you prefer to run services outside Docker:

```bash
# Install dependencies
pnpm install

# Start PostgreSQL (you'll need it running separately)
# e.g., via Homebrew: brew services start postgresql@16

# Copy and configure environment
cp .env.example .env
# Edit .env with your local database connection

# Run database migrations
pnpm db:migrate

# Seed the demo gymnastics club (optional)
pnpm --filter @club-manager/membership-service seed:demo:gym

# Start all services
pnpm dev
```

### Development

```bash
# Start all services in development mode
pnpm dev

# Or run specific applications:
pnpm dev:web          # Next.js web app only
pnpm dev:services     # All backend services
```

The web application will be available at http://localhost:3000

### Building

```bash
# Build all applications and services
pnpm build

# Build specific apps
pnpm build --filter=web
pnpm build --filter=@club-manager/membership-service
```

### Testing

```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm test:unit        # Unit tests
pnpm test:e2e         # End-to-end tests
pnpm test:coverage    # Generate coverage report
```

## Local Development Setup (Detailed)

This section walks through every step a new developer needs to go from a fresh clone to a fully running local environment.

### 1. Clone and install dependencies

```bash
git clone https://github.com/your-org/swimly.git
cd swimly
pnpm install
```

`pnpm install` resolves all workspace dependencies across `apps/`, `services/`, and `packages/`. Turborepo handles the build orchestration.

### 2. Set up environment files

Three `.env.example` files exist in the repository. You need to create local copies of each:

```bash
# Root environment (shared database, auth, and service config)
cp .env.example .env

# Web app environment
cp apps/web/.env.example apps/web/.env.local

# Membership service environment
cp services/membership/.env.example services/membership/.env
```

The defaults in each file are pre-configured for local development. The only value you **must** generate for a working auth flow is `JWT_SECRET`:

```bash
# Generate a secure JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Paste the output into `JWT_SECRET` in both the root `.env` and `services/membership/.env`.

For NextAuth, generate a separate secret:

```bash
openssl rand -base64 32
```

Paste the output into `NEXTAUTH_SECRET` in both the root `.env` and `apps/web/.env.local`.

### 3. Start infrastructure services

Use Docker Compose to start PostgreSQL and any supporting infrastructure:

```bash
# Option A: Full stack (PostgreSQL + all app services in containers)
docker compose up

# Option B: Infrastructure only (PostgreSQL, Redis, MinIO, MailHog, pgAdmin)
pnpm docker:up
```

**Option A** uses the root `docker-compose.yml` and boots PostgreSQL alongside the membership service, notifications service, and web app in containers. This is the simplest path.

**Option B** uses `infrastructure/docker/docker-compose.dev.yml` and starts only the supporting infrastructure. Choose this if you want to run the application services natively with `pnpm dev` for a faster feedback loop with hot-reloading.

### 4. Run database migrations

Once PostgreSQL is healthy, apply migrations:

```bash
# If using Docker (Option A)
docker compose exec membership pnpm db:migrate

# If running services natively (Option B)
pnpm db:migrate
```

### 5. Seed development data (optional)

```bash
# If using Docker
docker compose exec membership pnpm seed:demo:gym

# If running natively
pnpm --filter @club-manager/membership-service seed:demo:gym
```

This creates a demo gymnastics club with families, gymnasts, squads, sessions, invoices and award progress, so you have data to work with immediately. See docs/demos/gym-demo-club.md.

### 6. Start developing

```bash
# If using Option B (infrastructure in Docker, app services native)
pnpm dev
```

This runs the Next.js web app and all backend services in parallel with hot-reloading via Turborepo.

### Verifying everything works

Once all services are running, confirm the following URLs respond:

| Service           | URL                       | Description                         |
| ----------------- | ------------------------- | ----------------------------------- |
| Web App           | http://localhost:3000     | Next.js frontend                    |
| Membership API    | http://localhost:3001/api | NestJS membership service           |
| Notifications API | http://localhost:3005/api | NestJS notifications service (stub) |
| pgAdmin           | http://localhost:5050     | Database UI (Option B only)         |
| MailHog           | http://localhost:8025     | Email testing UI (Option B only)    |
| MinIO Console     | http://localhost:9001     | Object storage UI (Option B only)   |

## Environment Variables

Below is the complete list of environment variables used across the project. Default values are shown where provided.

### Root `.env`

These variables are shared across all services and are read by Docker Compose.

| Variable                    | Default                 | Description                                                                                                       |
| --------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `DB_HOST`                   | `localhost`             | PostgreSQL host                                                                                                   |
| `DB_PORT`                   | `5432`                  | PostgreSQL port                                                                                                   |
| `DB_USERNAME`               | `postgres`              | PostgreSQL username                                                                                               |
| `DB_PASSWORD`               | `postgres`              | PostgreSQL password                                                                                               |
| `DB_DATABASE`               | `swim_nexus_dev`        | PostgreSQL database name                                                                                          |
| `NODE_ENV`                  | `development`           | Application environment (`development`, `production`, `test`)                                                     |
| `JWT_SECRET`                | _(must generate)_       | Secret for signing JWTs. Generate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_EXPIRES_IN`            | `24h`                   | JWT token expiry duration                                                                                         |
| `NEXTAUTH_SECRET`           | _(must generate)_       | NextAuth.js session secret. Generate with `openssl rand -base64 32`                                               |
| `NEXTAUTH_URL`              | `http://localhost:3000` | Canonical URL of the web app                                                                                      |
| `CORS_ORIGINS`              | `http://localhost:3000` | Allowed CORS origins (comma-separated in production)                                                              |
| `NEXT_PUBLIC_API_URL`       | `http://localhost:3001` | Public URL of the membership API                                                                                  |
| `MEMBERSHIP_PORT`           | `3001`                  | Port for the membership service                                                                                   |
| `NOTIFICATIONS_PORT`        | `3005`                  | Port for the notifications service                                                                                |
| `EMAIL_HOST`                | `localhost`             | SMTP host (use MailHog on `localhost:1025` for local dev)                                                         |
| `EMAIL_PORT`                | `1025`                  | SMTP port                                                                                                         |
| `EMAIL_USER`                | _(empty)_               | SMTP username                                                                                                     |
| `EMAIL_PASSWORD`            | _(empty)_               | SMTP password                                                                                                     |
| `EMAIL_FROM`                | `noreply@swimly.app`    | Default "from" address for outgoing emails                                                                        |
| `GOCARDLESS_ACCESS_TOKEN`   | _(empty)_               | GoCardless API token (sandbox or live)                                                                            |
| `GOCARDLESS_ENVIRONMENT`    | `sandbox`               | GoCardless environment (`sandbox` or `live`)                                                                      |
| `GOCARDLESS_WEBHOOK_SECRET` | _(empty)_               | GoCardless webhook signing secret                                                                                 |
| `S3_ENDPOINT`               | `http://minio:9000`     | S3-compatible storage endpoint                                                                                    |
| `S3_ACCESS_KEY`             | _(empty)_               | S3 access key                                                                                                     |
| `S3_SECRET_KEY`             | _(empty)_               | S3 secret key                                                                                                     |
| `S3_BUCKET`                 | `swimly`                | S3 bucket name                                                                                                    |
| `LOG_LEVEL`                 | `debug`                 | Logging verbosity (`debug`, `info`, `warn`, `error`)                                                              |

### Web App `apps/web/.env.local`

These variables are specific to the Next.js frontend.

| Variable              | Default                     | Description                                               |
| --------------------- | --------------------------- | --------------------------------------------------------- |
| `NEXTAUTH_SECRET`     | _(must generate)_           | NextAuth.js session secret (same value as root)           |
| `NEXTAUTH_URL`        | `http://localhost:3000`     | Canonical URL of the web app                              |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api` | API base URL used by the browser. Note the `/api` suffix. |

### Membership Service `services/membership/.env`

These variables are specific to the NestJS membership microservice.

| Variable                    | Default                                | Description                                  |
| --------------------------- | -------------------------------------- | -------------------------------------------- |
| `NODE_ENV`                  | `development`                          | Application environment                      |
| `PORT`                      | `3001`                                 | Port the service listens on                  |
| `DB_HOST`                   | `localhost`                            | PostgreSQL host                              |
| `DB_PORT`                   | `5432`                                 | PostgreSQL port                              |
| `DB_USERNAME`               | `postgres`                             | PostgreSQL username                          |
| `DB_PASSWORD`               | `postgres`                             | PostgreSQL password                          |
| `DB_DATABASE`               | `swim_nexus_membership`                | Database name (can differ from root default) |
| `JWT_SECRET`                | _(must generate)_                      | Same JWT secret as root `.env`               |
| `JWT_EXPIRES_IN`            | `24h`                                  | JWT token expiry                             |
| `CORS_ORIGINS`              | `http://localhost:3000`                | Allowed CORS origins                         |
| `APP_URL`                   | `http://localhost:3000`                | URL of the web frontend                      |
| `EMAIL_HOST`                | `localhost`                            | SMTP host                                    |
| `EMAIL_PORT`                | `1025`                                 | SMTP port                                    |
| `EMAIL_SECURE`              | `false`                                | Whether to use TLS for SMTP                  |
| `EMAIL_FROM`                | `"Swim Club" <noreply@swimclub.co.uk>` | Default sender address                       |
| `GOCARDLESS_ACCESS_TOKEN`   | _(empty)_                              | GoCardless API token                         |
| `GOCARDLESS_ENVIRONMENT`    | `sandbox`                              | GoCardless environment                       |
| `GOCARDLESS_WEBHOOK_SECRET` | _(empty)_                              | GoCardless webhook secret                    |

> **Tip:** When running via Docker Compose (Option A), the root `.env` values are injected into each container automatically. You only need the service-level `.env` files when running services natively.

## Running Services

### All services at once

```bash
# Start everything in development mode with hot-reloading
pnpm dev
```

This uses Turborepo to run `dev` scripts across the web app and all backend services in parallel.

### Web app only

```bash
pnpm dev:web
```

Runs Next.js on http://localhost:3000. The web app expects the membership API to be available at the URL defined by `NEXT_PUBLIC_API_URL`.

### All backend services

```bash
pnpm dev:services
```

Starts all services under `services/` (currently membership and notifications).

### Individual services

To run a specific backend service directly:

```bash
# Membership service (from the service directory)
cd services/membership
pnpm dev           # or: pnpm start:dev
pnpm start:debug   # with Node.js inspector attached
```

### Notifications service

The notifications service (port 3005) exists as a stub and handles email dispatch and notification templates. It is included in `docker-compose.yml` but does not yet have a standalone `package.json` in the repository. For now, it runs only within Docker Compose. Full implementation is planned for a future phase.

### Infrastructure services (Docker)

```bash
# Start infrastructure (PostgreSQL, Redis, Kong, MinIO, MailHog, pgAdmin)
pnpm docker:up

# View logs
pnpm docker:logs

# Stop infrastructure
pnpm docker:down

# Restart infrastructure
pnpm docker:restart
```

### Port reference

| Port | Service                   |
| ---- | ------------------------- |
| 3000 | Next.js web app           |
| 3001 | Membership API            |
| 3005 | Notifications API (stub)  |
| 5432 | PostgreSQL                |
| 6379 | Redis                     |
| 8000 | Kong Gateway (HTTP proxy) |
| 8001 | Kong Admin API            |
| 8025 | MailHog web UI            |
| 1025 | MailHog SMTP              |
| 9000 | MinIO S3 API              |
| 9001 | MinIO Console             |
| 5050 | pgAdmin                   |

## Database Management

The membership service uses **TypeORM** for database access and migrations. All database commands are available from the root of the monorepo or from within `services/membership/`.

### Running migrations

```bash
# From root (runs migrations across all services)
pnpm db:migrate

# From the membership service directory
cd services/membership
pnpm db:migrate
```

Under the hood this executes:

```bash
typeorm-ts-node-commonjs migration:run -d src/config/typeorm.config.ts
```

### Creating a new migration

```bash
# From root
pnpm db:migrate:create --name=AddSwimmerNotes

# From the membership service directory
cd services/membership
pnpm db:migrate:create --name=AddSwimmerNotes
```

This generates a timestamped migration file in `services/membership/src/database/migrations/`.

### Reverting the last migration

```bash
cd services/membership
pnpm db:migrate:revert
```

### Seeding data

```bash
# Demo gymnastics club (British Gymnastics, GBP)
cd services/membership
pnpm seed:demo:gym

# Demo Australian swimming club, kept as the non-UK example
pnpm seed:demo:au
```

### Resetting the database

```bash
# Drop and recreate the local database, then rerun every migration
dropdb swim_nexus_dev && createdb swim_nexus_dev
pnpm db:migrate
```

Useful when you want a completely clean slate.

Alternatively, if you are using Docker, you can destroy the volume and start fresh:

```bash
docker compose down -v
docker compose up
# Then re-run migrations and seed
docker compose exec membership pnpm db:migrate
docker compose exec membership pnpm seed:demo:gym
```

### Inspecting the database

If you started infrastructure with `pnpm docker:up`, pgAdmin is available at http://localhost:5050:

- **Email:** admin@swimnexus.com
- **Password:** admin

Connect to the PostgreSQL server using host `postgres` (from within Docker) or `localhost` (from your machine), port `5432`, username `postgres`, password `postgres`.

## Testing

Swimly uses **Jest** for unit and integration tests and **Playwright** for end-to-end (E2E) browser tests.

### Running all tests

```bash
pnpm test
```

This runs test suites across all workspaces via Turborepo.

### Unit tests

#### Web app (React components)

The web app uses Jest with React Testing Library. Tests live in `apps/web/src/__tests__/` and match the pattern `*.test.{ts,tsx}`.

```bash
# Run all web unit tests
cd apps/web
pnpm test

# Run tests in watch mode (re-runs on file changes)
pnpm test:watch

# Run a specific test file
pnpm test -- --testPathPattern="swimmers"

# Generate a coverage report
pnpm test:coverage
```

Example test files:

- `apps/web/src/__tests__/login.test.tsx`
- `apps/web/src/__tests__/swimmers.test.tsx`
- `apps/web/src/__tests__/families.test.tsx`
- `apps/web/src/__tests__/attendance.test.tsx`
- `apps/web/src/__tests__/register.test.tsx`

#### Membership service (NestJS)

The membership service uses Jest with the NestJS testing utilities. Tests live alongside source files and match the pattern `*.spec.ts`.

```bash
# Run all membership service tests
cd services/membership
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run a specific test file
pnpm test -- --testPathPattern="swimmers.service"

# Generate a coverage report
pnpm test:cov
```

Example test file:

- `services/membership/src/modules/swimmers/swimmers.service.spec.ts`

### End-to-end tests (Playwright)

E2E tests verify that pages render correctly in a real browser. The test suite is in `apps/web/e2e/` and the configuration is in `apps/web/playwright.config.ts`.

#### First-time setup

Install the Playwright browsers before running E2E tests for the first time:

```bash
cd apps/web
npx playwright install
```

#### Running E2E tests

```bash
# Run all E2E tests (headless)
cd apps/web
pnpm test:e2e

# Run E2E tests with the interactive UI
pnpm test:e2e:ui

# View the HTML test report after a run
pnpm test:e2e:report
```

Playwright is configured to start the dev server automatically (`pnpm dev:web`) before tests run, so you do not need to start it manually. If you already have the dev server running, Playwright will reuse it.

#### Running from the monorepo root

```bash
pnpm test:e2e
```

This runs Playwright E2E tests across all workspaces that define a `test:e2e` script.

### Test configuration summary

| Scope              | Framework                    | Config file                                 | Command                               |
| ------------------ | ---------------------------- | ------------------------------------------- | ------------------------------------- |
| Web unit tests     | Jest + React Testing Library | `apps/web/jest.config.ts`                   | `cd apps/web && pnpm test`            |
| Service unit tests | Jest + NestJS Testing        | `services/membership/package.json` (inline) | `cd services/membership && pnpm test` |
| E2E smoke tests    | Playwright                   | `apps/web/playwright.config.ts`             | `cd apps/web && pnpm test:e2e`        |
| All tests (root)   | Turborepo                    | n/a                                         | `pnpm test`                           |

## Project Structure

The repository is organised as a monorepo using Turborepo:

```
swimly/
├── apps/
│   ├── web/                      # Next.js admin dashboard
│   │   ├── src/
│   │   │   ├── app/             # App Router pages (37 total)
│   │   │   │   ├── (auth)/     # Authentication flows
│   │   │   │   ├── (admin)/    # Admin-only pages
│   │   │   │   ├── swimmers/   # Swimmer management
│   │   │   │   ├── families/   # Family accounts
│   │   │   │   ├── squads/     # Squad management
│   │   │   │   ├── sessions/   # Training sessions
│   │   │   │   ├── attendance/  # Attendance tracking
│   │   │   │   ├── billing/    # Invoices & payments
│   │   │   │   ├── compliance/  # DBS & safeguarding
│   │   │   │   └── comms/      # Communications hub
│   │   │   ├── components/      # Reusable React components
│   │   │   └── lib/            # Utilities and API clients
│   │   └── package.json
│   └── marketing-site/          # Public marketing website
│       ├── src/
│       │   ├── pages/          # Astro pages
│       │   ├── components/      # Marketing components
│       │   └── content/        # CMS content
│       └── package.json
├── services/
│   ├── membership/              # Member & club management service
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── swimmers/
│   │   │   │   ├── families/
│   │   │   │   ├── squads/
│   │   │   │   ├── attendance/
│   │   │   │   ├── compliance/
│   │   │   │   └── clubs/
│   │   │   ├── database/
│   │   │   │   └── migrations/
│   │   │   └── main.ts
│   │   └── package.json
│   ├── finance/                 # Billing & payments service
│   ├── communications/          # Email, SMS, push notifications
│   ├── performance/             # Training data & analytics
│   └── api-gateway/            # Kong configuration
├── packages/
│   ├── shared-types/           # TypeScript types shared across services
│   ├── validation/             # Zod schemas for request validation
│   ├── utils/                  # Common utilities
│   └── database/               # Database utilities and helpers
├── infrastructure/
│   ├── docker/                 # Docker Compose files
│   ├── kong/                   # API Gateway configuration
│   └── terraform/              # AWS infrastructure (future)
└── docs/                       # Documentation
    ├── architecture/
    ├── api/
    └── guides/
```

## Features

Swimly provides 37 pages across the following functional areas:

### Authentication & Access (4 pages)

- Club registration and onboarding
- User login and password reset
- Multi-factor authentication
- Role-based access control (admin, coach, treasurer, parent)

### Administration (5 pages)

- Club settings and configuration
- User management
- Role assignment
- Audit logs
- System notifications

### Swimmer Management (6 pages)

- Swimmer profiles with medical information
- Swimmer registration (individual and CSV bulk import)
- Squad assignment
- Performance history
- Medical and emergency contacts
- Profile photos and documentation

### Family Management (4 pages)

- Family account dashboard
- Parent/guardian management
- Sibling linking
- Family billing summary

### Squad Management (5 pages)

- Squad creation and configuration
- Coach assignment
- Swimmer allocation
- Training schedule
- Squad performance overview

### Session & Attendance (5 pages)

- Session scheduling
- Session templates
- Attendance register (mark present/absent/late)
- Attendance reports
- Session notes

### Billing & Payments (6 pages)

- Invoice generation and management
- Payment collection (GoCardless/Stripe)
- Payment history
- Family account balance
- Direct Debit management
- Fee structure configuration

### Compliance & Safeguarding (4 pages)

- DBS check tracking
- Safeguarding certificate management
- Qualification tracking (coaching, first aid)
- Compliance dashboard and alerts

### Communications (5 pages)

- Announcement creation (club-wide, squad, individual)
- Email composer
- SMS messaging
- Push notification manager
- Communication history

### Parent Portal (3 pages)

- Family dashboard
- Swimmer attendance view
- Payment history and invoice download

## Fly.io Deployment

Swimly is configured for deployment on [Fly.io](https://fly.io) with the membership service and web application running as separate apps in the London (`lhr`) region.

### Prerequisites

1. Install the Fly.io CLI:

```bash
# macOS
brew install flyctl

# Linux / WSL
curl -L https://fly.io/install.sh | sh
```

2. Log in to your Fly.io account:

```bash
flyctl auth login
```

### Initial Setup

Create both Fly.io apps and a shared Postgres cluster:

```bash
# Create the apps (run from the repository root)
flyctl apps create swimly-membership
flyctl apps create swimly-web

# Provision a Fly Postgres cluster and attach it to the membership service
flyctl postgres create --name swimly-db --region lhr
flyctl postgres attach swimly-db --app swimly-membership
```

Fly automatically sets `DATABASE_URL` on the membership service when you attach the database.

### Environment Variables

Set secrets on each app. **Never commit real values to source control.**

```bash
# Membership service secrets
flyctl secrets set \
  JWT_SECRET="$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")" \
  NEXTAUTH_SECRET="$(openssl rand -base64 32)" \
  CORS_ORIGINS="https://swimly-web.fly.dev" \
  GOCARDLESS_ACCESS_TOKEN="your-token" \
  GOCARDLESS_ENVIRONMENT="sandbox" \
  GOCARDLESS_WEBHOOK_SECRET="your-webhook-secret" \
  --app swimly-membership

# Web application secrets
flyctl secrets set \
  NEXTAUTH_SECRET="$(openssl rand -base64 32)" \
  NEXTAUTH_URL="https://swimly-web.fly.dev" \
  --app swimly-web
```

### Database Setup

Once the Postgres cluster is running, apply migrations:

```bash
# Open a proxy to the database
flyctl proxy 15432:5432 --app swimly-db &

# Run migrations (set DATABASE_URL to point at the proxy)
DATABASE_URL="postgres://postgres:<password>@localhost:15432/swimly_membership" \
  pnpm --filter membership db:migrate

# (Optional) Seed initial data
DATABASE_URL="postgres://postgres:<password>@localhost:15432/club_membership" \
  pnpm --filter @club-manager/membership-service seed:demo:gym
```

### Deploying

Use the deployment script to deploy both services in the correct order:

```bash
# Deploy everything (membership first, then web)
./deploy.sh

# Deploy a single service
./deploy.sh membership
./deploy.sh web
```

Or deploy manually with `flyctl`:

```bash
# Membership service
flyctl deploy --config services/membership/fly.toml --dockerfile services/membership/Dockerfile.prod --remote-only

# Web application
flyctl deploy --config apps/web/fly.toml --dockerfile apps/web/Dockerfile.prod --remote-only
```

### Monitoring

```bash
# View live logs
flyctl logs --app swimly-membership
flyctl logs --app swimly-web

# Check application status
flyctl status --app swimly-membership
flyctl status --app swimly-web

# Open the web app in your browser
flyctl open --app swimly-web

# SSH into a running machine
flyctl ssh console --app swimly-membership
```

### Scaling

Both apps are configured to auto-scale between 1 and 2 instances. To adjust:

```bash
flyctl scale count 3 --app swimly-web
flyctl scale vm shared-cpu-2x --app swimly-membership
```

## Roadmap

### Phase 1: Core Operations (Current)

✅ Club registration and setup  
✅ Swimmer and family management  
✅ Squad management  
✅ Attendance tracking  
✅ Basic billing and invoicing  
✅ Parent portal  
✅ Communication tools

### Phase 2: Advanced Features

🚧 GoCardless variable Direct Debit  
🚧 Competition entry management  
🚧 Training plan builder  
🚧 Reporting and analytics

### Phase 3: Integrations

⏳ Swim England membership sync  
⏳ Wavepower compliance automation  
⏳ Calendar integrations (Google, Apple)

## Contributing

This project is under active development. Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on contributing to the codebase.

## Security & Compliance

- **GDPR compliant** with data encryption at rest and in transit
- **Wavepower 2024** safeguarding standards
- **UK data residency** for all customer data
- **Regular security audits** and penetration testing
- **Role-based access control** with audit logging

## Support

For issues, questions, or feature requests:

- Email: support@swimly.uk
- Documentation: https://docs.swimly.uk
- GitHub Issues: https://github.com/your-org/swimly/issues

## Licence

Copyright © 2026. All rights reserved.

---

**Built for British swim clubs, by people who understand swimming.**
