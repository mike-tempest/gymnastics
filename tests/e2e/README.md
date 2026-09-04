# Swimly E2E Test Suite

End-to-end tests for the Swimly API and frontend. Tests run against live staging or local instances.

## Setup

```bash
cd tests/e2e
npm install
```

## Configuration

Edit `.env.test` to point at the correct environment:

| Variable | Default | Description |
|----------|---------|-------------|
| `API_BASE_URL` | Railway staging API | Membership API base URL (with /api) |
| `WEB_BASE_URL` | Railway staging web | Next.js frontend URL |
| `TEST_ADMIN_EMAIL` | admin@rtwmonson.co.uk | Admin login email |
| `TEST_ADMIN_PASSWORD` | Demo2024! | Admin login password |

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
- **Resources** - users, swimmers, squads, sessions, attendance, families
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
