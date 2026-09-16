# TEM-59: billing adjustments implementation plan

Status: approved by Mike on 16 September 2026; implementation in progress. Prepared 16 September 2026 against main `35d4be7`.

Issue: https://linear.app/tempestfractional/issue/TEM-59/handle-prorated-fees-discounts-credits-refunds-and-fee-changes

Branch: `mike/tem-59-handle-prorated-fees-discounts-credits-refunds-and-fee`

## Current behaviour

Fee structures have one mutable amount and a frequency. Generation creates full-value invoice lines per family or gymnast, keyed by fee structure and billing period. Payments and club-bound provider adapters exist; there is no refund contract or credit-note workflow. Collection currently derives the outstanding amount from the original invoice total and payments, so adjustments must integrate with that calculation rather than becoming a parallel balance.

TEM-59 is unblocked in Linear. TEM-58 depends on it. TEM-22, TEM-57 and TEM-60 have outstanding dependencies and are not part of this run. TEM-56's timetable implementation is in PR #44, which is not yet on main; this plan does not assume permission to merge it.

## Proposed implementation

### 1. Versioned policies and exact calculations

Extend the existing finance modules with club-scoped, effective-dated fee revisions and billing policies. Add new reversible migrations; do not edit historical migrations or restructure the shared core.

Use integer minor units for intermediate arithmetic and explicit currency checks. Keep the existing external API conventions at their boundaries. Proration supports full-period charges, calendar-day allocation and session-based allocation when an explicit session schedule is available. Require real period boundaries for term and annual fees. Define date intervals consistently, split at fee-revision boundaries and round once per final line with deterministic remainder allocation.

Existing clubs retain full-period billing and no automatic discounts or credits until staff configure a policy. Amounts, notice windows, discount percentages and eligibility are club choices, not invented defaults.

### 2. One preview and commit path

Add a pure calculation service and a staff preview showing original charge, dates/units, selected fee revision, discounts, tax, credits, payments already confirmed, collections in flight and the amount still due. Freeze the policy inputs in the committed record.

A commit rechecks the preview against current fee revisions, membership inputs, invoice/payment state and existing adjustments. Stale previews must be regenerated. Joining, leaving, pauses and class changes can pass explicit effective dates into this service; TEM-58 will later supply the lifecycle events. This issue does not create a second membership lifecycle.

### 3. Explicit discounts

Support sibling and multi-class rules with clear eligibility, priority, exclusions and mutually exclusive groups. Default to a single eligible rule within each group; stacking requires explicit configuration and a visible calculation order. Display discounts as separate explanatory lines linked to their charge lines.

Calculate multi-class eligibility from distinct billable class/fee assignments in the preview. Do not infer extra enrolments from the number of weekly sessions or silently change squad membership. Ensure generation across multiple fee structures cannot apply the same family discount twice in a billing period.

### 4. Audited credits and policy events

Create append-only credit notes and allocations linked to the source invoice and lines, with staff identity, reason, effective date, policy version and operation reference. Use auditable reversal records for corrections. Preserve issued invoice amounts and historic line items.

Injury pauses and club cancellations have configurable credit policies and explicit staff approval through the adjustment preview. Persist a unique source-event reference so replaying a cancellation or pause cannot issue another credit. Support explicit event/date inputs without depending on the unmerged timetable PR; use existing dated sessions where relevant. Automatic lifecycle wiring remains TEM-58.

Apply credit once to the receivable. Keep credit owed to the family, credit allocated to an unpaid invoice and cash refunded distinct so a refund cannot reopen a debt or create a second benefit accidentally. Reflect adjustments in invoice detail, PDFs and parent balances.

### 5. Provider-backed refunds and reconciliation

Add refund capabilities to the existing club-bound GoCardless and Stripe adapters. Verify current official API contracts and sandbox behaviour before implementing provider calls. Resolve the original payment's provider and club account rather than assuming the club's current provider is the same. Reject mismatched accounts and unsupported/manual payment methods honestly.

Persist each refund intent before the provider call, with a stable idempotency key. Reserve the requested refundable amount transactionally, including other pending refunds, so concurrent requests cannot over-refund a payment. Represent requested, submitted/pending, confirmed, failed and uncertain outcomes explicitly. A timeout is uncertain, not proof of failure; reconciliation must resolve it before a new attempt can issue another refund.

Extend verified webhook handling deliberately and add reconciliation for missed or out-of-order events. Only provider confirmation marks a cash refund complete. This implementation uses mocked providers and sandbox checks; approval does not authorise live refunds or charges.

### 6. Collection and balance integration

Use the same balance calculation in staff/parent displays, invoice status decisions and collection. Include applied credits and committed/in-flight collection attempts; do not treat a pending payment as settled or available for a second collection.

Record collection intents before external calls and give each logical attempt its own stable reference. Retrying the same intent must reuse its provider key, while a separately authorised later collection must not collide merely because it has the same amount. Reconcile uncertain outcomes before releasing reserved balances. Keep Direct Debit first and retain the existing provider connection, mandate and finance modules.

### 7. Staff and parent interface

Add policy controls, effective-dated fee revision previews, invoice adjustment history and refund actions within the existing fee/invoice/payment screens. Require exact administrator/treasurer permissions for financial mutations; parents only see their own balances and outcomes. Use React Hook Form, Zod, TanStack Query, shared UI primitives, British copy and accessible controls.

Confirmations show the exact amount, currency, family, source invoice/payment, policy and resulting balance. Previewing or saving a policy does not initiate a provider transaction. Refunds require an explicit action in the delivered product.

## Verification and delivery

- Calculation tests: leap years, inclusive/exclusive boundaries, mid-period changes, day/session allocation, currency rounding, tax-inclusive/exclusive cases, discount eligibility and stacking.
- PostgreSQL tests: stale previews, duplicate events, concurrent credits/refunds/collections, partial payments, rollback and cross-club access.
- Provider tests: failure before/after submission, timeout after success, duplicate/out-of-order webhooks, account mismatch and retry reconciliation. Record any unavailable sandbox evidence as outstanding, not passing.
- UI tests: preview before commit, exact resulting balances, pending/failed/uncertain refund display and parent access boundaries.
- Run migration up/down/up on a fresh disposable database, all tests including tenant isolation, build, lint, formatting and the no-Swimly gate.
- Commit green steps on the issue branch and open one reviewable PR. Do not merge or deploy. Keep TEM-59 open until all acceptance criteria and verification are satisfied.

## Approval recorded

Mike approved this plan on 16 September 2026. Implementation is authorised within the scope above, including mocked and sandbox provider checks, commits and a PR. Live provider transactions, merging and deployment remain outside this work.
