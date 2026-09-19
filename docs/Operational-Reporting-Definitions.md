# Operational reporting definitions

Definition version: 2026-09-19.1. This is the first, deliberately limited delivery of TEM-73. The issue remains open for the producer-dependent measures below.

The existing Reports page now includes operational reports. Only club administrators and treasurers can call the summary, records and CSV endpoints. Every query obtains the club from the authenticated tenant context. A supplied class must belong to that club. Responses contain no waiting-list names, contact details, acceptance tokens or staff notes.

## Available measures

| Measure                     | Numerator and denominator                                                                                                                     | Date and scope                                                                                                                                                                                                                                                                                       |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current occupancy           | Assigned class places divided by the sum of positive recorded class capacities. This is a weighted rate, not an average of class percentages. | Current canonical squad_members assignments. A child in two classes occupies two places. The legacy primary class field is not counted again. Pending offers reserve places separately. Unknown or non-positive capacity classes and their assigned places are disclosed and excluded from the rate. |
| Issued-cohort acceptance    | Accepted offers / all offers issued, including pending and withdrawn.                                                                         | offered_at within the inclusive club-local date range; response status observed now.                                                                                                                                                                                                                 |
| Resolved acceptance         | Accepted / (accepted + declined + expired).                                                                                                   | The same issued cohort. Pending and withdrawn offers are excluded from this denominator.                                                                                                                                                                                                             |
| Gross invoiced              | Sum of non-draft, non-cancelled invoice face values.                                                                                          | Invoice issued_date within the inclusive range. Credits are not deducted.                                                                                                                                                                                                                            |
| Gross confirmed collections | Sum of currently confirmed payment allocations.                                                                                               | Business payment_date within the inclusive range. Excludes failed, submitted and pending payments. This is neither bank settlement nor net of refunds.                                                                                                                                               |

Currencies remain separate. Aggregation uses database decimal arithmetic and returns exact integer minor-unit strings. The application currently stores money to two decimal places; the display does not round through a JavaScript floating-point number.

Blank dates default to the current month in the club's configured time zone. Timestamps use club-local midnight boundaries, including daylight-saving transitions. Each request uses one repeatable-read database snapshot and returns its observation time and definition version. Summary, record and export requests share filters and definitions, but are separate snapshots: concurrent changes can change totals between requests. Date ranges are limited to 367 days. Records paginate in stable identifier order at 100 per page; exports reject more than 10,000 rows and require narrower filters. CSV cells escape quotes and neutralise leading spreadsheet formula characters.

Class and discipline filters apply to occupancy and offer cohorts. Discipline is the class's current classification, not a reconstructed historic classification. Family invoices lack reliable class allocation, so class-filtered finances are explicitly unavailable, never silently shown as unfiltered totals. Clear those filters to see club-wide money.

A zero denominator displays “No eligible data”, not a 0% success rate. Failed reads display an error and retry action, never an empty result. Missing financial records are labelled as such. Existing leaver reporting now returns null with a reason instead of the previous fabricated empty list.

## Not yet available

- Historical occupancy and retention require dated membership intervals, capacity snapshots and departure/transfer reasons (TEM-58).
- Enrolment completion requires authoritative consent, invitation and first-collection milestones (TEM-22).
- Trial conversion requires trial attendance and an agreed conversion window (TEM-57).
- Net arrears and uninvoiced forecasts require the complete credit/refund and scheduled-obligation contracts (TEM-59).

These measures have no supported historical start date yet. No historical activity is inferred from creation timestamps, current state or missing rows. TEM-73 must not be closed until its remaining producers, definitions, supported-date coverage and acceptance scenarios are delivered.

## Acceptance evidence

The dedicated PostgreSQL reporting suite exercises weighted 19/30 occupancy, unknown capacity, tenant isolation, ten-offer cohorts, UK daylight-saving boundaries, precise mixed-currency sums, excluded payment states, unavailable class finance, invalid filters, null denominators, matching record/export counts and CSV escaping. Frontend tests cover missing versus failed data, shared filters, export failures and exact money display. Provider transactions are outside this release.
