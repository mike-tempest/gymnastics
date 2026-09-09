# Quick Start Guide

Get the Membership Service running in 5 minutes!

## Prerequisites Check

```bash
# Check Node.js version (need >= 20.0.0)
node --version

# Check PostgreSQL is running
psql --version
```

## Installation Steps

### 1. Install Dependencies

From the **root** of the monorepo:

```bash
pnpm install
```

### 2. Setup Database

Create the database:

```bash
# Using createdb command
createdb swim_nexus_membership

# OR using psql
psql -U postgres -c "CREATE DATABASE swim_nexus_membership;"
```

### 3. Configure Environment

The `.env` file is already created with defaults. Update if needed:

```bash
cd services/membership
cat .env
```

Default configuration:

- Port: 3001
- Database: swim_nexus_membership
- DB Host: localhost:5432
- DB User: postgres

### 4. Run Database Migrations

```bash
cd services/membership
pnpm db:migrate
```

You should see:

```
query: SELECT * FROM "information_schema"."tables"...
Migration CreateSwimmersTable1703260000000 has been executed successfully.
```

### 5. Start the Service

```bash
pnpm dev
```

You should see:

```
🚀 Membership Service is running on: http://localhost:3001/api
📊 Environment: development
```

## Test the Service

### Health Check

```bash
curl http://localhost:3001/api/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "membership-service",
  "timestamp": "2023-12-22T10:30:00.000Z"
}
```

### Create a Member

```bash
curl -X POST http://localhost:3001/api/members \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Smith",
    "dob": "2010-05-15",
    "gender": "M",
    "registration_number": "1234567"
  }'
```

### Get All Members

```bash
curl http://localhost:3001/api/members
```

### Get Statistics

```bash
curl http://localhost:3001/api/members/statistics
```

## Troubleshooting

### Database Connection Error

If you see: `error: database "swim_nexus_membership" does not exist`

Solution:

```bash
createdb swim_nexus_membership
```

### Port Already in Use

If port 3001 is busy, edit `.env`:

```env
PORT=3002
```

### TypeORM Errors

If migrations fail:

```bash
# Check database exists
psql -U postgres -l | grep swim_nexus

# Re-run migrations
pnpm db:migrate
```

### Module Not Found

If you see module errors:

```bash
# From monorepo root
pnpm install

# Build shared packages
cd packages/shared-types && pnpm build
cd ../utils && pnpm build
```

## Next Steps

1. Read the full [README.md](./README.md) for detailed documentation
2. Explore the API endpoints in the README
3. Add more modules (families, clubs, squads)
4. Integrate with the web frontend

## Development Workflow

```bash
# Watch mode (auto-reload on changes)
pnpm dev

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Build for production
pnpm build
pnpm start
```

## API Endpoints Summary

| Method | Endpoint                    | Description      |
| ------ | --------------------------- | ---------------- |
| GET    | /api/health                 | Health check     |
| POST   | /api/members                | Create member    |
| GET    | /api/members                | List all members |
| GET    | /api/members/:id            | Get member by ID |
| PATCH  | /api/members/:id            | Update member    |
| DELETE | /api/members/:id            | Delete member    |
| GET    | /api/members?family_id={id} | Filter by family |
| GET    | /api/members?club_id={id}   | Filter by club   |
| GET    | /api/members?squad_id={id}  | Filter by squad  |
| GET    | /api/members/statistics     | Get statistics   |

## Success!

If you can access the health endpoint and create a member, you're all set!

The service is now ready for development and integration with the frontend.
