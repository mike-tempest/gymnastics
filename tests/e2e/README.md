# API E2E Test Suite

End-to-end tests for the membership API and frontend, run against a locally
running stack.

## Setup

```bash
cd tests/e2e
npm install
```

Seed a local database with the demo gymnastics club first, then start the API
and the web app against it. See `docs/demos/gym-demo-club.md`.

## Configuration

Edit `.env.test` to point at the correct environment. It ships with the demo
club's credentials, which exist only in a locally seeded database:

| Variable              | Default                            | Description                         |
| --------------------- | ---------------------------------- | ----------------------------------- |
| `API_BASE_URL`        | http://localhost:3001/api          | Membership API base URL (with /api) |
| `WEB_BASE_URL`        | http://localhost:3000              | Next.js frontend URL                |
| `TEST_ADMIN_EMAIL`    | admin@kestrelvalegym.org.uk        | Admin login email                   |
| `TEST_ADMIN_PASSWORD` | Demo2024!                          | Admin login password                |
| `TEST_COACH_EMAIL`    | rachel.oduya@kestrelvalegym.org.uk | Head coach login email              |
| `TEST_PARENT_EMAIL`   | claire.ashworth@example.com        | Parent login email                  |

## Running Tests

```bash
# All tests
npm test

# API tests only
npm run test:api

# Frontend smoke tests only
npm run test:frontend
```

## Test Coverage

### API Tests

- **Auth** - login, invalid credentials, profile, unauthorised access
- **Resources** - users, members, squads, sessions, attendance, families
- **Finance** - fee structures, invoices, payments, mandates
- **Compliance** - summary, DBS, consents, audit logs, safeguarding
- **Roles** - admin/coach/parent access control verification

### Frontend Smoke Tests

- Public pages return 200 (login, register)
- Protected pages redirect to login when unauthenticated
- API health check responds

## Adding Tests

Each test file follows the pattern `api.<domain>.test.ts` or `frontend.<domain>.test.ts`.
Use helpers from `helpers.ts` for authentication and API calls.
