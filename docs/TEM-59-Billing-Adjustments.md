# Billing adjustments (TEM-59)

## Staff workflow

Open **Billing > Billing policies and invoice previews**. Administrators and treasurers can add an effective-dated policy, schedule a fee revision, and preview a family invoice with explicit start, end and due dates. Confirmed invoices join the existing scheduled collection process; previewing never sends a payment request.

A preview includes every applicable fee of the selected frequency for that family. It uses the policy effective at the period start. Fee revisions split the period on their effective dates. The server checks the preview again when saving. An overlapping family/frequency billing run is rejected, and retries of the same accepted preview return its existing invoice.

The invoice detail page shows balances, credit history, refunds and collections. Staff can preview a manual credit or a policy credit for an injury pause or club cancellation. Refunds require available credit, a confirmed provider payment, the original connected account and a separate confirmation. Credit can instead be transferred to another unpaid invoice of the same family and currency. Corrections use reversal notes; spent or refunded credits cannot be reversed.

## Calculation conventions

- Monetary arithmetic uses integer minor units. Supported currencies have two decimal places.
- Date intervals include both endpoints; periods contain 1 to 366 days.
- Full-period billing charges the full period when activity overlaps it. Day billing uses active days. Session billing uses the staff-confirmed schedule, with one entry per session, including separate entries for sessions on the same date.
- Fee changes apply from the effective date, including that date. The weighted fee is rounded once per charge, half up.
- A sibling rule applies to all eligible lines when the eligible family member count reaches its threshold. Multi-class eligibility counts distinct billable fee assignments, not weekly sessions. Fee restrictions apply both to eligibility and the discounted lines.
- Lower priority numbers run first. Ties use the rule identifier. Without explicit stacking, only the first eligible rule runs. With stacking, one rule per exclusive group runs against the remaining amount. Remainder pennies are allocated deterministically in charge order.
- Tax is rounded per final discounted line. The committed snapshot records the tax rate, inclusive/exclusive treatment, revisions, policy and calculation.
- Policy credits use the original saved charge, including discounts and tax. Event dates select the affected billing units and their original rate weights. Injury notice days delay the first eligible date. Later policy changes do not rewrite prior invoices.

## One ledger

The original invoice and issued lines remain unchanged. Credit notes reduce the receivable. Confirmed payments reduce the amount due; pending payments and unlinked collection intents reserve the amount that can be collected. Excess confirmed payment becomes available credit, reduced by transfers and all non-failed refund reservations. A cash refund against available credit does not reopen the settled debt.

All consumers of an invoice balance lock the same invoice row. Transfers lock source and destination in identifier order. A collection or refund intent is committed before calling the provider. Each logical operation has its own UUID and provider idempotency key.

An unknown submission result remains **uncertain** and keeps its reservation. Reconciliation searches provider records for the operation metadata or retrieves the known provider resource. It does not resend an uncertain operation, even if no matching object is found. Absence from a list is not evidence of failure. A five-minute task and the staff **Check provider status** action retry reconciliation. Verified webhooks request a fresh provider read, so event delivery order does not decide the final state.

Legacy provider payments without a recorded original account cannot be automatically refunded. Changes to the connected account and refunds made outside this workflow require reconciliation before another automated refund. Manual cash and bank-transfer payments do not pretend to support provider refunds.

## Provider contracts checked

- [GoCardless refund API](https://docs.gocardless.com/docs/api-reference/refund): refunds name the original payment, use minor units and include the cumulative refund confirmation amount. The club-bound SDK client supplies the operation key.
- [GoCardless refund events](https://docs.gocardless.com/docs/api-reference/events/refund): creation is not payment to the customer; settlement/failure is reconciled from the refund resource.
- [Stripe refund API](https://docs.stripe.com/api/refunds/create): refunds use the original PaymentIntent, exact minor units and the connected account header.
- [Stripe idempotency](https://docs.stripe.com/api/idempotent_requests): keys may be removed after 24 hours. This workflow therefore discovers uncertain operations instead of replaying old requests.

## Verification record

Local verification on 16 September 2026 passed: full workspace build, lint (zero errors; existing warnings remain), formatting, the no-Swimly gate, and migration up/down/up on a fresh disposable PostgreSQL database. Tests passed: 1,984 backend and 445 web (2,429 total), including both optional PostgreSQL suites. All 17 tenant-isolation suites were exercised. External payment and email providers were mocked.

The implementation includes pure calculation tests, PostgreSQL concurrency/isolation tests, provider adapter tests, role/family access tests and interface preview/confirmation tests. Run the PostgreSQL suite against a disposable local database using `TEM59_TEST_DATABASE_URL`; the test refuses remote hosts or an unexpected database name. It creates uniquely identified fixtures and does not contact payment providers.

Actual provider sandbox verification is outstanding. No test credentials were present in this checkout when implementation started. Mocked provider results are not sandbox evidence. Keep TEM-59 open and the PR in draft until the following have been exercised on connected test accounts:

1. A partial and remaining GoCardless refund, including insufficient available refund funds, confirmation-total rejection and duplicate submission.
2. Stripe partial refunds on the connected account, pending/failed outcomes and duplicate submission.
3. A lost response recovered through provider metadata, verified webhook delivery and subsequent reconciliation.
4. Confirmation that both providers record the club account, operation reference, amount and currency expected by the saved intent.

No live charges, live refunds, merge or deployment are authorised by this implementation plan.
