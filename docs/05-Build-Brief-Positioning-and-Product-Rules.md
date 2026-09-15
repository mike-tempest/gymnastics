# Build Brief: Positioning and Product Rules

**Audience:** every build session in this repo (Claude Code reads this via `CLAUDE.md`).
**Status:** competitive claims refreshed 15 September 2026 under TEM-7. Product rules remain in force; vendor capabilities are qualified by the linked evidence.
**Derived from:** `docs/04-UK-Gymnastics-Competitive-Analysis.md` (strategy) and `docs/04-Incumbent-Landscape-Pricing-and-Exports.md` (vendor export reference). Read those for evidence; read this for what to build.

---

## 1. What we are building

> **The operations and compliance platform for gymnastics clubs. Waiting list to enrolled, Direct-Debit-billed, safeguarding-compliant member in one click. Works alongside My BG.**

We are **not** a class-booking marketplace, a payment processor, a competition-scoring tool, or a replacement for British Gymnastics' membership system. Every feature decision should be testable against the sentence above.

## 2. Who we are positioned against

Use [the current competitive evidence](04-UK-Gymnastics-Competitive-Analysis.md) and [pricing/export reference](04-Incumbent-Landscape-Pricing-and-Exports.md), checked 15 September 2026. “Not documented in the reviewed sources” does not mean a feature is absent.

| Alternative            | Documented capability                                                                                                     | What we must establish in a club comparison                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| JustGo for Clubs       | BG offering with no subscription charge, online transaction fees, recurring sessions, trials, renewals and BG integration | Actual transaction fees, BG-specific payment methods and waiting-list automation depth                               |
| ClassForKids           | Recurring card subscriptions, trials, transfers, term reruns, family plans and financial/register exports                 | Actual quote and export coverage; do not claim no discounts or no exports                                            |
| Thrive4                | Existing GoCardless or London & Zurich account linking, BG/IGA report matching, insurance expiry alerts and reminders     | Club configuration, staff credential workflows and export schema; do not claim a compulsory proprietary payment rail |
| iClassPro / Jackrabbit | Workflow benchmarks for automatic offers (iClassPro), skills, make-ups and scheduling                                     | UK terms, relevant plan entitlement and a hands-on workflow comparison                                               |
| DIY tools              | A club's current collection of payment, spreadsheet and form processes                                                    | Observe the handoffs and duplication at that club rather than assuming every DIY setup is identical                  |

Do not claim exclusivity for automatic offers or club compliance. iClassPro documents prioritised, expiring offers with fallthrough; Thrive4 documents gymnastics insurance workflows. Tumblebase's opportunity is a demonstrably effective combination of operations, club-owned Direct Debit and safeguarding workflows. This is a positioning hypothesis to validate with clubs.

## 3. Product rules (non-negotiable)

1. **Direct Debit first, GoCardless in the club's own organisation.** We never introduce our own payment rail. Cards (Stripe) are secondary. Every billing feature must work for DD before card. Support _importing_ an existing GoCardless organisation where account ownership and provider rules allow mandate reuse; verify this for each migration.
2. **Compliance is a first-class module, not a notes field.** DBS / first-aid / coach-qualification records with **expiry dates and alerts**, and a **Welfare Officer** view. This is inherited from Swimly (`compliance/dbs`, `safeguarding`, `consents`); extend it, never simplify it away.
3. **The hero flow is waiting list → enrolled member.** One action creates the member, family, mandate, register place and consent requests. Waiting lists **auto-offer** places by configurable priority (existing members / siblings first), with **time-boxed acceptance** and automatic fallthrough. Manual invite is the fallback, never the default.
4. **Badges are data.** Award schemes (BG Rise, legacy Proficiency Awards, a club's own) are configurable records, not hard-coded. Do not depend on a Rise Hub API; provide a **CSV bridge** and reverify available integration options before making external claims. Badge/certificate fees bill through the normal finance path.
5. **Works alongside My BG.** The BG membership number is a first-class, reconcilable field (expiry / insurance mismatch alerts). We never ask a club to choose between us and the NGB tool.
6. **Published pricing and a one-click full export + API** are product features, not marketing. Build the export early; it is the trust signal against opaque fees and vendors who "own the database".
7. **Home-nation aware.** England/Wales DBS, Scotland PVG, Northern Ireland AccessNI are already in `GOVERNING_BODY_CONFIG`. **Wales runs on Sport:80, not JustGo**; add a Welsh Gymnastics entry when Wales is in scope; do not assume My BG.
8. **Member in code, Gymnast in copy.** Unchanged (see `CLAUDE.md`).

## 4. What this changes on the backlog

| Issue                                      | Change                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **TEM-18** badges                          | Schemes-as-data (Rise Discover/Explore/Excel as seed data, not enum); assessment events; badge-fee billing via `finance`; **Rise CSV export/import bridge**; no API dependency                                                                                                                                                 |
| **TEM-19 / TEM-20** rec levels, discipline | Unchanged; discipline and pre-school/adult flags drive filtering only                                                                                                                                                                                                                                                          |
| **TEM-22** hero flow                       | Spec explicitly: auto-offer with priority rules, time-boxed acceptance, fallthrough, one-click enrol → member + family + GoCardless mandate + register + consents. Prove the complete journey; automated offers alone are not exclusive                                                                                        |
| **TEM-23** importers                       | **Order:** (1) GoCardless organisation takeover (DIY + Class Manager), (2) ClassForKids financial-analysis + register spreadsheet mapper (confirm the contact export scope with a real sample), (3) Thrive4 exports after confirming the current format, (4) Bookwhen / Coacha CSV, JustGo once a real club provides an export |
| **TEM-25** marketing site                  | Lead with the positioning sentence; a **public pricing page** and a **data-export promise**; a "works alongside My BG" section; use the qualified TEM-7 comparisons and cite their checked dates                                                                                                                               |
| **New**                                    | Welsh Gymnastics (Sport:80) governing-body config entry; create when Wales is in scope                                                                                                                                                                                                                                         |
| **New**                                    | Full-export endpoint (members, families, mandates, attendance, awards as CSV/JSON) + read API; schedule after TEM-22                                                                                                                                                                                                           |
| **Do not build**                           | Competition scoring (flagged off), a class-booking marketplace (the informational directory exception below remains authorised), a proprietary payment rail, anything that duplicates My BG membership administration                                                                                                          |

## 5. Pricing hypothesis (to test with founding clubs)

Test a published flat fee in the £25-£35/month band with an explicitly defined free tier and processor fees passed through at cost. This is not an approved price or guaranteed saving. GoCardless UK Standard currently lists 1% + 20p capped at £4, excluding VAT, with an additional charge on the amount over £2,000 for Direct Debits. Check other fees, eligibility and the club's actual plan before quoting a total. [GoCardless pricing, checked 15 September 2026](https://gocardless.com/pricing).

Compare against each club's actual vendor quote and payment mix. The earlier ClassForKids 0.5% recurring surcharge, guaranteed charity discount and blanket claim to be cheaper than other vendors are not approved current evidence.

## 6. Evidence and release discipline

The 5 September market-size and waiting-list estimates remain historical research in Git history. Reverify definitions and dates before using them publicly. Do not treat vendor support pages as market-share data or hands-on usability evidence.

The hero flow is a product target. TEM-22 remains open for complete enrolment and confirmed collection, so marketing must distinguish implemented steps from unproven end-to-end outcomes. “Works alongside My BG” does not mean a native integration or British Gymnastics endorsement.

## Approved marketing directory exception (TEM-52, 14 September 2026)

Mike approved a public UK gymnastics club directory on the Tumblebase marketing site for discovery and SEO, following the existing directory approach. This supersedes the earlier discovery-directory exclusion for informational marketing pages only. The product still does not include a booking marketplace. Listings require public sources, a checked date, a correction route and honest coverage statements.
