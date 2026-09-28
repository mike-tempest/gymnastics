# Award skills and assessments

Clubs define their own criteria on each badge. Criteria can be required or optional, ordered, edited and archived. No licensed British Gymnastics skill content is seeded. The next badge can be configured within the same scheme; otherwise display order is used. Cycles are rejected, including changes caused by reordering levels.

Coaches can open an assessment from a session register or choose a class on the assessment page. Existing attendance entries remain on a session register after a class move. A cancelled session cannot receive skill assessments. Results start at “Leave unchanged”. Saving skill progress does not award a badge or create an invoice. Required skills provide a readiness indication; the coach makes the separate award decision.

Each skill assessment preserves its original criterion name and guidance, date, assessor, optional session, result and notes. Changes append history and increment the progress version. Stale edits are rejected rather than overwriting another coach's result. The parent view contains only the owning family's child and the explicitly parent-visible note. Staff notes stay in the coach history.

Schemes and levels are archived rather than deleted. Active criteria and achieved archived criteria appear in parent progress. Archive a criterion by clearing its Active setting. Existing Rise CSV column names are unchanged. Imports record achievements without charging; fees are reviewed separately on the assessment page.

## Fees and retry handling

Badge fees are off by default. The fee preview identifies each child and family, currency, tax-inclusive total and reasons for skipping charges. Confirmation is rejected if prices, tax, family assignment or an existing invoice has changed since the preview.

The assessment, invoice, items and unique club/child/level invoice source commit in one database transaction. Request keys and payload fingerprints prevent duplicate saves after a lost response. A different request cannot invoice the same award twice. Existing invoice links are adopted by the migration.

Invoice emails and normal Direct Debit attempts run after commit using the existing finance service. Replaying an assessment does not repeat those effects. A process failure after commit can therefore leave an invoice awaiting normal finance follow-up. Check that invoice and its collection state before using the existing finance controls; do not create a second badge invoice to recover delivery.

## Verification

`services/membership/test/awards.jest.json` runs against a disposable PostgreSQL database on port 55462, database `tumblebase_awards_test`, with the synthetic user/password `tumblebase_test`. It exercises full migrations, the new migration down/up, tenant boundaries, immutable history, stale edits, register membership, preview changes, simultaneous saves, rollback, taxes and replay after a lost response. The award workflow in GitHub Actions runs these checks for every PR.

These tests stub external invoice delivery and payment collection. They do not replace the separate GoCardless and Stripe provider acceptance tests.
