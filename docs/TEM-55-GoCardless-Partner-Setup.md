# GoCardless Partner connection (TEM-55)

Each club authorises its own GoCardless organisation. Collections use that club's encrypted token. Environment-token fallback is no longer supported.

## Setup

Use a dedicated Tumblebase Partner app, separate from any other product. Start in sandbox. Configure the membership service securely:

- `APP_URL`: the web app's public origin.
- `GOCARDLESS_ENVIRONMENT`: `sandbox` or `live`.
- `GOCARDLESS_CLIENT_ID` and `GOCARDLESS_CLIENT_SECRET`: Partner app credentials for that environment.
- `GOCARDLESS_WEBHOOK_SECRET`: the Partner webhook endpoint signing secret.
- `PAYMENT_TOKEN_KEY_ID`: the current encryption key identifier, such as `v1`.
- `PAYMENT_TOKEN_KEYS`: a JSON object mapping key identifiers to cryptographically random 32-byte keys encoded as 64 hexadecimal characters. Generate and store these securely. Never commit values.

Register the exact redirect URL `APP_URL/admin/settings` with GoCardless. Live redirects require HTTPS. Configure Partner webhooks to the membership service's public `/api/webhooks/gocardless` endpoint, including organisation disconnection events.

Apply migrations before releasing the service. The new migration adds one-use OAuth state and durable webhook receipts. The existing payment connection table stores encrypted credentials.

From admin settings, select **Connect with GoCardless** and authorise the club's organisation. The initiating administrator must complete the flow in the same club within ten minutes. Failed or interrupted callbacks require a fresh attempt. OAuth codes and state are removed from the browser URL and redacted from application audit changes.

## Verification and imported mandates

An organisation must have exactly one creditor with successful verification before collections are enabled. Incomplete verification stays pending. Multiple creditors require a product extension for explicit selection; this release does not choose one automatically.

Use **Check imported mandates** to verify existing references against the connected organisation. References are never rewritten. The synchronous check supports up to 500 mandates; larger migrations require a separate migration review. Each collection verifies creditor readiness and access to its mandate again.

One active payment provider per club remains enforced. Resolve existing provider setup before connecting a different provider. Reconnection must use the same organisation and environment to preserve existing references.

## Disconnect and rotation

Local disconnection clears the stored credential and outstanding OAuth requests, stops new collections, and preserves payment history. It does not cancel mandates or submitted payments at GoCardless. Revoke application access in the GoCardless dashboard as well.

While disconnected, automatic payment-state reconciliation pauses because the credential has been removed. Review outstanding payments in GoCardless before disconnecting. Reconnect the same organisation and review outstanding payments before resuming normal operation; missed events may require provider replay or manual reconciliation. A delayed revocation event does not disconnect a newer valid token.

For key rotation, add the new key alongside old keys in `PAYMENT_TOKEN_KEYS`, then change `PAYMENT_TOKEN_KEY_ID`. New authorisations use the new key. Keep old keys until all affected clubs have reconnected and their stored `encryption_key_id` has changed. Removing a key early makes its credentials unreadable and stops collections safely.

## Webhook behaviour

Signatures are verified against the raw body before account routing. Unknown organisations and resources owned by another club are ignored. Known resources are read back from the club's GoCardless account, preventing older events from overwriting newer provider status. Processed event IDs are stored durably. A failed item returns a retryable response after the rest of its batch has been attempted.

Unknown resources less than ten minutes old are retried to allow local creation to commit. Older unknown resources are acknowledged as unrelated activity. Creation failures that leave a remote resource without a local record require operational reconciliation.

## Sandbox acceptance checklist

Use two separate test clubs and sandbox organisations. Record outcomes in TEM-55 without secrets or bank details.

1. Authorise both clubs and verify their organisation IDs and sandbox labels.
2. Cancel authorisation, retry, and attempt a callback from the wrong administrator or club. No unintended connection should be saved.
3. Keep an unverified account pending, then complete verification and refresh its status.
4. Create a mandate and collect one test invoice per club. Confirm the correct organisation receives each payment and the invoice balance updates via signed webhooks.
5. Import a valid mandate reference and one from the other organisation. Confirm the latter is reported and cannot be charged.
6. Replay and reorder payment events. Confirm balances and payment status remain correct.
7. Disconnect, verify new collection is refused, reconnect the same organisation, and exercise dashboard revocation.
8. Rotate the encryption key while retaining the previous key and verify old and new connections remain readable.

Automated coverage includes encryption and tampering, callback ownership and replay, real PostgreSQL tenant isolation, payment routing, raw signatures, webhook retries and settings interactions. These checks do not substitute for sandbox acceptance.

## References

- [GoCardless Partner authorisation](https://docs.gocardless.com/docs/partner-integrations/connect-your-merchants)
- [Merchant verification](https://docs.gocardless.com/docs/partner-integrations/getting-your-users-verified)
