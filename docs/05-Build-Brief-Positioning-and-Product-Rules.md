# Build Brief — Positioning and Product Rules

**Audience:** every build session in this repo (Claude Code reads this via `CLAUDE.md`).
**Status:** current as of 5 September 2026. Supersedes any earlier framing of "class-booking incumbents".
**Derived from:** `docs/04-UK-Gymnastics-Competitive-Analysis.md` (strategy) and `docs/04-Incumbent-Landscape-Pricing-and-Exports.md` (vendor export reference). Read those for evidence; read this for what to build.

---

## 1. What we are

> **The operations and compliance platform for gymnastics clubs. Waiting list to enrolled, Direct-Debit-billed, safeguarding-compliant member in one click. Works alongside My BG.**

We are **not** a class-booking marketplace, a payment processor, a competition-scoring tool, or a replacement for British Gymnastics' membership system. Every feature decision should be testable against the sentence above.

## 2. Who we are positioned against (verified facts the build may rely on)

| Alternative | What it is | The gap we own |
|---|---|---|
| **JustGo for Clubs** | British Gymnastics' *official* club solution since 26 Aug 2025; **free (no subscription) to every registered club**; tiered transaction fees (unpublished); native My BG sync | Its announcement mentions **no Direct Debit / GoCardless**; waiting lists are **manual invites**; **no Rise/badge progression**; **no club-level safeguarding tracking** (DBS is handled at NGB level in My BG) |
| **ClassForKids** (Access Group) | Volume incumbent for kids' activity booking | **Card-only** — "recurring card payment rather than a direct debit", **+0.5%** surcharge, one plan per parent, no discount codes on subscriptions; manual waiting lists; no badges; no DBS; **no customer/family export, no API** |
| **Thrive4** (ex-LoveAdmin) | Deepest gymnastics customer list; true Direct Debit | Pricing removed from site; DD on a **proprietary rail (London & Zurich)** the club doesn't control; migration pain in reviews |
| **DIY** (GoCardless + spreadsheet / Google Forms) | Very common | No link between waiting list, membership, register and billing; medical data in spreadsheets |

**Facts we can cite in product copy and sales (all verified at source, Sep 2026):** ClassForKids subscriptions are card-only with a 0.5% surcharge; JustGo for Clubs is free but documents no Direct Debit; GoCardless raw cost is **1% + 20p capped at £4** (25% off for charities); nobody in the UK market ships club-level DBS/qualification expiry tracking or true auto-offer waiting lists.

## 3. Product rules (non-negotiable)

1. **Direct Debit first, GoCardless in the club's own organisation.** We never introduce our own payment rail. Cards (Stripe) are secondary. Every billing feature must work for DD before card. Support *importing* an existing GoCardless organisation so a club migrates with zero re-mandating.
2. **Compliance is a first-class module, not a notes field.** DBS / first-aid / coach-qualification records with **expiry dates and alerts**, and a **Welfare Officer** view. This is inherited from Swimly (`compliance/dbs`, `safeguarding`, `consents`) — extend it, never simplify it away.
3. **The hero flow is waiting list → enrolled member.** One action creates the member, family, mandate, register place and consent requests. Waiting lists **auto-offer** places by configurable priority (existing members / siblings first), with **time-boxed acceptance** and automatic fallthrough. Manual invite is the fallback, never the default.
4. **Badges are data.** Award schemes (BG Rise, legacy Proficiency Awards, a club's own) are configurable records, not hard-coded. Rise Hub has no public API — provide a **CSV bridge**. Badge/certificate fees bill through the normal finance path.
5. **Works alongside My BG.** The BG membership number is a first-class, reconcilable field (expiry / insurance mismatch alerts). We never ask a club to choose between us and the NGB tool.
6. **Published pricing and a one-click full export + API** are product features, not marketing. Build the export early; it is the trust signal against opaque fees and vendors who "own the database".
7. **Home-nation aware.** England/Wales DBS, Scotland PVG, Northern Ireland AccessNI are already in `GOVERNING_BODY_CONFIG`. **Wales runs on Sport:80, not JustGo** — add a Welsh Gymnastics entry when Wales is in scope; do not assume My BG.
8. **Member in code, Gymnast in copy.** Unchanged (see `CLAUDE.md`).

## 4. What this changes on the backlog

| Issue | Change |
|---|---|
| **TEM-18** badges | Schemes-as-data (Rise Discover/Explore/Excel as seed data, not enum); assessment events; badge-fee billing via `finance`; **Rise CSV export/import bridge**; no API dependency |
| **TEM-19 / TEM-20** rec levels, discipline | Unchanged; discipline and pre-school/adult flags drive filtering only |
| **TEM-22** hero flow | Spec explicitly: auto-offer with priority rules, time-boxed acceptance, fallthrough, one-click enrol → member + family + GoCardless mandate + register + consents. This is the clearest gap in the market; over-invest here |
| **TEM-23** importers | **Order:** (1) GoCardless organisation takeover (DIY + Class Manager), (2) ClassForKids financial-analysis + register spreadsheet mapper (they have no customer export), (3) Thrive4 CSV/TSV, (4) Bookwhen / Coacha CSV, JustGo once a real club provides an export |
| **TEM-25** marketing site | Lead with the positioning sentence; a **public pricing page** and a **data-export promise**; a "works alongside My BG" section; quote the verified ClassForKids / JustGo gaps carefully and factually |
| **New** | Welsh Gymnastics (Sport:80) governing-body config entry — create when Wales is in scope |
| **New** | Full-export endpoint (members, families, mandates, attendance, awards as CSV/JSON) + read API — schedule after TEM-22 |
| **Do not build** | Competition scoring (flagged off), a class-booking marketplace / discovery directory, a proprietary payment rail, anything that duplicates My BG membership administration |

## 5. Pricing hypothesis (to test with founding clubs)

Published flat fee in the **£25–£35 / month** band, free below a small member count, **GoCardless passed through at cost** (1% + 20p, capped £4). Rationale: cheaper on DD than Coacha (2.2% + 24p), cheaper in total than ClassForKids (£34.99 + 2.5% + 0.5% card-only), and makes JustGo's "free" look expensive once its tiered fees land on £50/month Direct Debits. Ask every founding-club prospect what they pay today; JustGo's actual tiers and Thrive4's pricing are unpublished.

## 6. Market facts to keep in mind

~1,000–1,400 British Gymnastics registered clubs; ~400,000 members; recreational programmes are the large majority; parents pay **~£30–70 / month** for one weekly class, mostly by Direct Debit on the 1st; BG and its funders cite **0.5–1 million** children on waiting lists (advocacy figures). The addressable pain is exactly the hero flow.
