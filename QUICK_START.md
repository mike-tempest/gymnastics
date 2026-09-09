# Swimly: Quick Start Guide

Get Swimly running on your local machine.

---

## Docker Compose (Recommended for Full-Stack Dev)

The quickest way to run the entire stack locally.

### Prerequisites

- Docker Desktop (or Docker Engine + Compose plugin)
- No Node.js required for this method

### Steps

1. Copy the environment file:

   ```bash
   cp .env.example .env
   ```

2. Build and start all services:

   ```bash
   docker compose up --build
   ```

3. Visit http://localhost:3000

### What Starts

| Service           | URL                       | Description                  |
| ----------------- | ------------------------- | ---------------------------- |
| Web app           | http://localhost:3000     | Next.js frontend             |
| Membership API    | http://localhost:3001/api | NestJS membership service    |
| Notifications API | http://localhost:3005     | NestJS notifications service |
| PostgreSQL        | localhost:5432            | Database                     |

### Useful Commands

```bash
# Start in background
docker compose up -d --build

# View logs for a specific service
docker compose logs -f membership

# Stop all services
docker compose down

# Stop and remove database volume (fresh start)
docker compose down -v

# Rebuild a specific service
docker compose build membership
```

---

## Manual Setup (pnpm)

If you prefer running services outside Docker, or need to work on individual packages.

### Prerequisites

Install these first:

- **Node.js 20+**: [nodejs.org](https://nodejs.org/)
- **pnpm**: `npm install -g pnpm`
- **Docker Desktop**: [docker.com](https://www.docker.com/) (still needed for PostgreSQL)

Verify installation:

```bash
node --version    # Should be v20.x.x+
pnpm --version    # Should be 8.15.x+
docker --version  # Should be 24.x.x+
```

### Steps

1. Clone and install dependencies:

   ```bash
   git clone https://github.com/your-org/swim-nexus.git
   cd swim-nexus
   pnpm install
   ```

2. Copy environment variables:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` if needed (defaults work for local development).

3. Start infrastructure (PostgreSQL, Redis, MinIO, MailHog, Kong):

   ```bash
   ./scripts/setup-dev-env.sh
   ```

4. Start the application:

   ```bash
   pnpm dev
   ```

5. Visit http://localhost:3000

---

## Services Overview

| Service           | Port | Notes                |
| ----------------- | ---- | -------------------- |
| Next.js web app   | 3000 | Main frontend        |
| Membership API    | 3001 | `/api` global prefix |
| Notifications API | 3005 | No global prefix     |
| PostgreSQL        | 5432 | Primary data store   |

---

## Test Data

After seeding, the following accounts are available:

| Role      | Email                | Password   |
| --------- | -------------------- | ---------- |
| Admin     | `admin@test.com`     | `password` |
| Treasurer | `treasurer@test.com` | `password` |
| Coach     | `coach@test.com`     | `password` |
| Parent    | `parent@test.com`    | `password` |

---

## Common Commands

```bash
# Development
pnpm dev                    # Start all services
pnpm dev:web                # Start Next.js only
pnpm dev:services           # Start backend services only

# Building
pnpm build                  # Build everything
pnpm build --filter=web     # Build Next.js only

# Testing
pnpm test                   # Run all tests
pnpm test:e2e               # Run E2E tests
pnpm test --filter=membership  # Test a specific service

# Database
pnpm db:migrate             # Run migrations
pnpm --filter @club-manager/membership-service seed:demo:gym  # Seed the demo club

# Code Quality
pnpm lint                   # Lint all code
pnpm format                 # Format with Prettier
pnpm typecheck              # TypeScript type checking
```

---

## Troubleshooting

### "Port already in use"

```bash
# Find the process using a port
lsof -i :3000

# Stop the process
kill -9 <PID>
```

### "Cannot connect to Docker daemon"

Make sure Docker Desktop is running.

### Database connection errors

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Verify connection settings in .env
grep DB_ .env

# Re-run migrations
pnpm db:migrate
```

### Next.js errors

```bash
# Clear Next.js cache
rm -rf apps/web/.next

# Reinstall dependencies
rm -rf node_modules
pnpm install
```

---

## Next Steps

1. Log in as different user types (admin, coach, parent) to explore the application.
2. Read the [Architecture Overview](./ARCHITECTURE.md) and [Development Guide](./DEVELOPMENT_GUIDE.md).
3. Try modifying a component in `apps/web/src/components/`; hot reload updates instantly.
4. Run `pnpm test` to check everything passes.
