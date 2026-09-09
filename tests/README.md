# Swimly E2E Test Suite

This directory contains end-to-end tests for the Swimly application, verifying that both the API and frontend work correctly.

## Test Coverage

### API Endpoint Tests

Location: `services/membership/src/e2e/api.e2e.test.ts`

Tests all major API endpoints:

- Authentication (login, register, profile)
- Users (15 expected)
- Members (30 expected)
- Squads (4 expected)
- Sessions (78 expected)
- Attendance
- Families (10 expected)
- Finance (fee structures, invoices, payments, mandates)
- Compliance (DBS checks, consents, audit logs, safeguarding)
- Communications

### Frontend Smoke Tests

Location: `tests/frontend-smoke.e2e.test.ts`

Tests web application routes:

- Public routes (login, register) return 200
- Protected routes redirect to login when unauthenticated (307)

## Running Tests

### Against Staging Environment (Default)

```bash
# From project root
npm run test:e2e
```

This runs tests against the Railway staging environment:

- API: http://localhost:3001
- Web: http://localhost:3000

### Against Local Development Environment

```bash
# Test API against local backend
API_BASE_URL=http://localhost:3001 npm run test:e2e

# Test frontend against local Next.js dev server
WEB_BASE_URL=http://localhost:3000 npm run test:e2e

# Test both against local
API_BASE_URL=http://localhost:3001 WEB_BASE_URL=http://localhost:3000 npm run test:e2e
```

### Run Specific Test Suites

```bash
# API tests only
npm run test:e2e -- services/membership/src/e2e/api.e2e.test.ts

# Frontend smoke tests only
npm run test:e2e -- tests/frontend-smoke.e2e.test.ts
```

## Test Credentials

The tests use the demo gymnastics club's admin account:

- **Email:** admin@kestrelvalegym.org.uk
- **Password:** Demo2024!

Seed it into a local database with `pnpm seed:demo:gym` from
`services/membership` before running the suite. See
`docs/demos/gym-demo-club.md`.

## Configuration

Test environment variables are defined in `.env.test` at the project root:

```env
API_BASE_URL=http://localhost:3001
WEB_BASE_URL=http://localhost:3000
```

You can override these by setting environment variables when running the tests (see examples above).

## Test Independence

Each test is independent and does not rely on the execution order of other tests. The test suite:

1. Authenticates once at the start (in API tests)
2. Reuses the authentication token for subsequent requests
3. Does not modify data (read-only operations)
4. Can be run multiple times without side effects

## Expected Behaviour

### Success Criteria

All tests should pass when:

- The staging/local environment is running
- The database contains the expected demo data
- All API endpoints are accessible
- Authentication is working correctly

### Common Failures

**401 Unauthorized errors:**

- Check that demo data has been seeded
- Verify test credentials are correct
- Ensure JWT secret is consistent

**Connection errors:**

- Verify the API/web servers are running
- Check firewall/network settings
- Confirm the URLs are correct

**Data count mismatches:**

- Database may have been modified
- Re-seed the demo data
- Check for data migrations that changed counts

## Continuous Integration

These tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run E2E Tests
  run: npm run test:e2e
  env:
    API_BASE_URL: ${{ secrets.STAGING_API_URL }}
    WEB_BASE_URL: ${{ secrets.STAGING_WEB_URL }}
```

## Maintenance

When adding new features:

1. Add corresponding test cases to the appropriate file
2. Update expected counts if database schema changes
3. Add new test files for new modules
4. Keep tests focused and independent

## Troubleshooting

### Tests hang or timeout

Increase Jest timeout in the test files:

```typescript
jest.setTimeout(30000); // 30 seconds
```

### SSL/Certificate errors

For local development with self-signed certificates:

```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run test:e2e
```

### Tests pass locally but fail in CI

- Check environment variable configuration
- Verify network access to staging environment
- Confirm CI has necessary secrets configured
