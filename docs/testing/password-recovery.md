# Password recovery (TEM-64)

Parents and staff follow **Forgot password?** on the sign-in page. Recovery uses the existing account email and never accepts a user, family or club identifier. Case-insensitive ambiguous addresses and inactive accounts receive the same acknowledgement as unknown addresses, with no email sent.

## Security and session policy

- Links contain 256 random bits and expire after 30 minutes. Only a SHA-256 hash is stored, excluded from normal entity reads. A successful reset consumes the link and increments the account's session version in one conditional database update.
- Existing backend JWTs immediately fail authentication after reset, including legacy JWTs with no session version once the account has reset. Protected browser navigation validates its NextAuth backend token, and API clients clear a rejected token and return to sign-in. The reset page also clears the current browser's token and NextAuth session. Other accounts, including another parent in the same family, retain their sessions.
- Request limits are five requests per IP per 15 minutes and ten reset attempts per IP per 15 minutes. An atomic database update enforces a further one-minute cooldown per account across instances. The IP limits use the existing in-process Nest throttler; each instance has its own IP counters. The application's existing auth limiter also applies. Authenticated profile checks do not consume the login attempt budget.
- Requesting another link after the cooldown supersedes the old one. Updating an account's email or password, or deactivating it through the user-update path, revokes outstanding links. Password changes through that path also invalidate sessions.
- Passwords require at least eight characters and at most 72 UTF-8 bytes, matching bcrypt's input limit. Unicode is supported. Reset does not automatically sign the user in.
- Links use a URL fragment, which is removed when the reset page opens. No token is kept in browser storage. Recovery pages exclude reset events from analytics and client error reporting, and use a no-referrer policy.

## Email configuration and failure handling

Set `APP_URL` to the Tumblebase web origin, `EMAIL_FROM` to the verified sender and `RESEND_API_KEY` to the existing email provider credential. The legacy `EMAIL_PASSWORD` provider-key fallback is unchanged. Link destinations come from configuration, never a request's Host header.

Delivery is initiated asynchronously so public response time does not depend on the provider. Missing configuration or rejected delivery revokes only the affected link and logs a generic error without credentials or provider payloads. The acknowledgement never claims delivery succeeded. The user may request another link after the one-minute account cooldown.

This uses the existing email provider without a durable queue. Process termination between token creation and provider acceptance may lose a send; the user can request a new link. Provider acceptance is not proof of inbox delivery. Durable operational email is tracked separately in TEM-71.

Apply migration `1789657200000-AddPasswordRecovery` before deploying the service. Rollback removes the recovery fields and session versions; roll back the matching application code as well.

## Verification

The normal `pnpm test` command covers validation, session versions, provider failures and the page states. CI additionally runs a PostgreSQL-backed suite with full migration up/down/up, concurrent issuance and consumption, account/club/family boundaries, expiry, delivery failure, request limits and a real HTTP login/reset/login journey. Email transport is mocked; no test sends real email.

Run that database suite locally with a dedicated container, separate from any application database:

```sh
docker run --detach --rm --name tumblebase-tem64-postgres \
  -e POSTGRES_USER=tumblebase_test -e POSTGRES_PASSWORD=tumblebase_test \
  -e POSTGRES_DB=tumblebase_tem64 -p 127.0.0.1:55464:5432 postgres:16-alpine
pnpm exec turbo run build --filter=@club-manager/shared-types --filter=@club-manager/utils
pnpm --filter @club-manager/membership-service exec jest --config test/password-recovery.jest.json --runInBand
docker stop tumblebase-tem64-postgres
```

The suite deliberately does not read application `.env` files. Its host, database and test credentials are fixed; `RECOVERY_TEST_PORT` can override only the local port. Use it only with the disposable container above. Deployment still needs an inbox smoke test using the configured sender and a dedicated test account.
