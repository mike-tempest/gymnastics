# Operational email delivery

TEM-71 reuses the generic delivery design evaluated in TEM-43: a transactional outbox, leased database claims, immutable provider keys, a provider-event inbox and staff follow-up. No source infrastructure, volunteering features or competition code is included.

Broadcast creation and cancellation transitions save recipient work in the same transaction as the business change. Cancellation includes standalone status changes and recurring timetable edits. Initial holiday exclusions in a newly created timetable are already cancelled, so they do not announce a cancellation of a previously scheduled session. Repeated cancellation updates do not enqueue again; reinstatement suppresses outstanding work, and a later cancellation is a new event. An email already in flight cannot be recalled.

Recipients remain the affected families' primary contacts, as before. Missing addresses and unlinked families are surfaced for manual follow-up. An address changed after enqueue is suppressed rather than silently redirecting an immutable message. Broadcasts and cancellations remain operational. Marketing unsubscribe behaviour is unchanged; marketing messages still honour the existing suppression store.

The worker claims up to 20 records every 30 seconds. Multiple instances use database locks and five-minute leases. Temporary errors retry with exponential backoff, up to eight automatic attempts. Each delivery keeps the same recipient, subject, body and Resend idempotency key. Uncertain attempts stop after 23 hours, before [Resend's 24-hour deduplication period](https://resend.com/docs/dashboard/emails/idempotency-keys) expires. Manual retry is allowed only without provider acceptance, with a usable saved address and within that safe window. Otherwise staff must follow up manually.

The staff view appears on communication and session details. It distinguishes queued, sending, provider-accepted, delivered, failed and suppressed. Provider acceptance is never labelled delivery. Delivery means a receiving mail server accepted the email, not that a person read it. The API excludes email bodies and addresses from this view, scopes all actions by club and allows only administrators/head coaches for broadcasts, plus squad coaches for session cancellations.

## Deployment configuration

Use only the Tumblebase Resend account, verified sender and environment. Set `RESEND_API_KEY`, `EMAIL_FROM` and `RESEND_WEBHOOK_SECRET`. Configure a webhook to the membership API's `/api/notification-deliveries/resend-events` route with `email.delivered`, `email.bounced`, `email.complained`, `email.failed` and `email.suppressed`. The endpoint verifies the exact raw body, signature and timestamp using the Resend SDK. Database failures return an error so the provider retries. Evidence arriving before the send acknowledgement is retained and reconciled. Duplicate or delayed delivery events do not overwrite a failure or suppression.

Run the new migration before starting the updated service. No historical migrations change. Missing provider configuration produces visible failed records rather than silent success. Existing messages are not backfilled or resent.

## Verification

The dedicated `Durable email delivery` CI workflow runs migrations on disposable PostgreSQL, rolls the new migration down and up, then exercises transactional rollback, tenant restrictions, concurrent workers, expired leases, deduplicated retries, provider-event ordering, suppression, cancellation transitions and timetable edits. Normal unit tests cover signature verification, access policy, send acknowledgement, unsubscribe categories and staff actions.

Local database command: `pnpm --filter @club-manager/membership-service exec jest --config test/deliveries.jest.json --runInBand`. It is deliberately fixed to a disposable local database on port 55465 named `tumblebase_delivery_test`; never point it at a live database.

Live acceptance remains a release check: send a labelled operational broadcast and cancellation only to an explicitly supplied controlled inbox, verify provider acceptance and the signed delivery event independently, inspect the inbox, then check a provider failure/suppression test event and record manual follow-up. No live inbox receipt has been claimed from automated or mocked tests.
