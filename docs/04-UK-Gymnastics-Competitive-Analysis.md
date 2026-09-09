# UK Gymnastics Club-Management Software — Competitive Analysis

**Prepared for:** Mike Tempest · **Date:** 5 September 2026 · **Linear:** TEM-7
**Scope:** every platform with a verified or marketed footprint in UK gymnastics club management, plus market structure and data-portability findings for the Phase 3 importers.
**Method:** vendor sites, help centres, Companies House, review sites (Trustpilot / Capterra / G2), British Gymnastics and JustGo announcements, club websites. Pricing is as published on the date checked; anything unverifiable is marked.

---

## 1. Executive summary — three things that change the plan

**1. The incumbent to beat is JustGo for Clubs, not ClassForKids.** In August 2025 British Gymnastics made JustGo for Clubs its _official recommended club solution_, **free of charge (no subscription) to every registered club**, with tiered transaction fees on online payments and a native sync to My BG membership. JustGo already runs BG's national membership platform (since July 2024). It claims to support "1,400+ gymnastics clubs" — note that is BG's _total_ club count, not verified adopters; adoption figures are unpublished. You cannot win on free class booking or "we sync with BG membership". You win on what JustGo doesn't do (§8).

**2. ClassForKids — the volume incumbent — has no Direct Debit at all.** Its subscriptions are recurring _card_ payments via Stripe Billing with a 0.5% surcharge, one plan per parent, no discount codes or sibling discount on subscriptions (verified against their help centre), waiting lists are manual invites, there's no badge/skills tracking, no DBS tracking, and **no customer/family export**. It was acquired by The Access Group (Feb 2023) and recent reviews show support erosion. This is the softest large target in the market.

**3. Nobody ships club-level compliance or true auto-offer waiting lists.** Across every vendor, DBS / coach-qualification expiry tracking and welfare-officer dashboards are absent (Coacha's "safeguarding section" is a notes vault; JustGo handles DBS at NGB level, not club level). Waiting lists are manual invites everywhere except two tiny vendors (A2B, Gymnastify). Both are things Swimly already does or was designed to do — they are the fork's most defensible edge.

**Two structural facts to design around:** BG's Rise award data lives in a **Fitronics-built silo (Rise Hub)** with no third-party API found — badges must be modelled as data with a CSV bridge; and **Welsh Gymnastics runs on Sport:80, not JustGo**, so Wales needs its own data path.

---

## 2. Market structure and size

| Metric                                  | Figure                                                                                                                                            | Confidence                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| British Gymnastics members              | ~400,000 (2023–25 statements)                                                                                                                     | Verified statements, not audited          |
| BG registered clubs                     | ~1,000 (BG, Aug 2025) to ~1,400 incl. delivery partners / leisure centres (May 2024)                                                              | Verified but inconsistent definitions     |
| Children doing gymnastics (England)     | 42% of ages 5–7, 36% of ages 7–11 (Active Lives 2024-25, as reported)                                                                             | Secondary reporting                       |
| Recreational vs competitive             | Not published; recreational is the large majority (proxy: membership categories, club statements)                                                 | Estimate                                  |
| Volunteer / charity / CIC vs commercial | No published split; BG's Club Capital fund lends only to incorporated forms (Ltd, CIC, CIO, charitable co.)                                       | Unverified                                |
| Typical club size                       | ~100 (Rib Valley) to 1,000+ (Woking); ~285–400 by division                                                                                        | Estimate                                  |
| Recreational fees parents pay           | **~£30–70 / month** for one weekly class; pre-school £32–45; squads £125–165+; mostly Direct Debit on the 1st                                     | Verified samples                          |
| BG membership (individual)              | ~£18–24 / yr recreational, ~£60 competitive (2024–27)                                                                                             | Verified samples                          |
| Waiting lists                           | BG has claimed "over 1 million" (2017); Better Society Capital cites ~0.5 million (2025); BG told Parliament clubs have "a sizeable waiting list" | Advocacy figures, methodology unpublished |

**Read:** ~1,000–1,400 clubs, dominated by recreational programmes billed monthly by Direct Debit, with structural over-demand. The addressable pain (waiting lists → enrolment → DD, compliance, badges) is real and is _not_ what the free NGB tool leads with.

---

## 3. The landscape map

| Tier                                  | Who                                                                                                                                                                                       | Threat level                        | Why                                                                                                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. NGB-endorsed**                   | **JustGo for Clubs** (BG official, free); **Fitronics CoursePro** (BG "official sports software supplier", built Rise Hub; enterprise pricing); **Sport:80** (Welsh Gymnastics' platform) | **High**                            | Free + official + My BG sync. Generic NGB platform; no DD confirmed for BG instance, no Rise, no club-level DBS, fees unpublished.                   |
| **B. UK kids-class / club tools**     | **ClassForKids** (Access Group), **Thrive4** (ex-LoveAdmin, Pay Here Ltd), **Class Manager**, **Coacha**, **Gymnastify**, **A2B Manager**, Bookwhen, ClubRight, Membermojo, Happity       | **High (ClassForKids, Thrive4)**    | Where the clubs actually are today. ClassForKids = volume, no DD. Thrive4 = deepest gymnastics list, true DD, opaque pricing.                        |
| **C. Generic team tools**             | Spond, TeamUp, Pitchero, Playwaze                                                                                                                                                         | Low–medium                          | Spond has one gymnastics case study; card-only, manual waitlists. Others have no gymnastics evidence.                                                |
| **D. DIY stacks**                     | GoCardless + spreadsheet; Stripe/SumUp + Google Forms / Jotform / Wufoo                                                                                                                   | **High as a _source of customers_** | Common (Cheshire, Corby, Saltire, Tooting, Bedwas…). Zero switching cost — these are your easiest wins.                                              |
| **E. US / international specialists** | iClassPro, Jackrabbit, Uplifter, Sportlyzer                                                                                                                                               | Low                                 | USD pricing, proprietary US card processing, no Bacs DD, no UK compliance; a couple of UK gyms on iClassPro. Only relevant to large commercial gyms. |

---

## 4. Head-to-head on what matters

|                           | JustGo for Clubs                                               | ClassForKids                               | Thrive4 (LoveAdmin)                             | Class Manager                             | Coacha                   | Gymnastify        | A2B Manager       | CoursePro          | **The fork**                                              |
| ------------------------- | -------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------- | ----------------------------------------- | ------------------------ | ----------------- | ----------------- | ------------------ | --------------------------------------------------------- |
| BG relationship           | **Official, free, My BG sync**                                 | none                                       | BG membership reconciliation feature            | none                                      | none                     | none              | none              | **Built Rise Hub** | BG config + membership-number field; CSV bridge to Rise   |
| **Direct Debit**          | not stated for BG instance (GoCardless on other NGB instances) | **none — card only**                       | yes (historically GoCardless → London & Zurich) | **yes, GoCardless in club's own account** | yes, GoCardless 2.2%+24p | **none — Stripe** | **none — Stripe** | recurring DD       | **GoCardless-native, mandate import**                     |
| Waiting list              | manual invite                                                  | manual invite; no discounts on WL bookings | yes, behaviour unknown                          | manual approval                           | **weak / none**          | auto              | auto (claimed)    | n/p                | **auto-offer, time-boxed, priority rules**                |
| Family / sibling billing  | family rates                                                   | partial — **not on subscriptions**         | family accounts                                 | auto discounts                            | partial                  | n/p               | n/p               | n/p                | **inherited from Swimly**                                 |
| DBS / welfare compliance  | NGB-level only                                                 | **none**                                   | partial (insurance tracking)                    | none                                      | notes vault              | n/p               | none              | n/p                | **club-level DBS + expiry + welfare officer (inherited)** |
| Badge / award progression | **none**                                                       | **none**                                   | generic                                         | partial                                   | generic                  | own ladders       | generic           | **Rise itself**    | schemes-as-data (Rise / Proficiency / club)               |
| Parent app / portal       | yes                                                            | yes                                        | yes                                             | yes                                       | yes                      | n/p               | n/p               | HomePortal         | inherited                                                 |
| Customer data export      | n/p                                                            | **finance + registers only**               | CSV / TSV                                       | CSV                                       | partial                  | CSV               | n/p (Zapier)      | n/p                | **full export + API (promise it)**                        |

---

## 5. Pricing benchmark (as published, Sep 2026 unless dated)

| Vendor                  | Subscription                                                         | Transaction fees                                                                          | Notes                                                  |
| ----------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **JustGo for Clubs**    | **£0** for BG clubs                                                  | tiered, **not published** (reference: same product for British Rowing = 2% + 20p +VAT)    | The price anchor you're positioned against             |
| **ClassForKids**        | from **£34.99/mo** (2 months free annually); Enterprise POA          | "from 2.5% inc Stripe" **+0.5% on subscriptions**; actual % quoted per club               | Fees can't be passed to parents on subscriptions       |
| **Thrive4 / LoveAdmin** | **not published** (Capterra: ~£35/mo Activity Providers, unverified) | not published; legacy GoCardless DD was **4.15% min 24p**                                 | Reports of a £20k turnover minimum and onboarding fees |
| **Class Manager**       | **£0**                                                               | **2.7% + 20p all-in** (UK page) / "1% + processor" (help centre) — vendor admits mismatch | Most migratable DD setup                               |
| **Coacha**              | £0 (≤50) / **£36/mo** / £60/mo (50% off first 3 months)              | card 2.5%+20p ex VAT; **DD 2.2% + 24p inc VAT**; SMS 4.9p                                 | Cheapest full GoCardless option                        |
| **Gymnastify**          | £0 (≤25) / **£29.99/mo** / £79.99                                    | Stripe                                                                                    | Closest UK analogue; no DD; no named customers         |
| **A2B Manager**         | £0                                                                   | platform fee "dependent on club size", **not published**                                  | Tiny vendor, continuity risk                           |
| **Spond Club**          | app free (website £19/mo)                                            | **2.5% + 20p** incl. Stripe                                                               | Card only                                              |
| **GoCardless direct**   | £0                                                                   | **1% + 20p capped £4**; 25% off for charities/non-profits                                 | What DIY clubs pay today — your floor                  |
| iClassPro / Jackrabbit  | $139–299 / $49–245 per month                                         | proprietary US processing                                                                 | Not UK-localised                                       |

**Implication:** the realistic band for a volunteer-run club is **£0–£36/month plus ~1–2.5% on collections**. A published, flat price plus GoCardless pass-through (1% + 20p, capped) undercuts everyone with DD and is _cheaper than ClassForKids' card-only stack_ on every recurring payment — quantify that in sales.

---

## 6. Competitor profiles (the ones that matter)

### JustGo for Clubs — the free NGB tool

JustGo Group Ltd (London; formerly Azolve / GoMembership) runs My BG and, since Aug 2025, offers JustGo for Clubs free to BG-registered clubs (Scottish Gymnastics mirrors the offer). Features: recurring / one-off / PAYG classes, subscriptions and instalments, class-specific and club-wide waitlists (**staff invite manually**), app attendance, family rates, email templates, events and competitions, shop, website builder, **My BG membership sync**. **Not documented:** Direct Debit for the BG instance, Rise / badge progression, club-level DBS tracking, SMS, data-export terms, and the actual fee tiers. Named users: Rib Valley Gymnastics (~100 members), Notts Gymnastics Academy. Weakness clubs cite about generic NGB platforms: UX built for federations, not volunteer admins.
**How to beat it:** be the _operations_ layer JustGo isn't — GoCardless DD with failed-payment handling, auto-offer waiting lists, sibling billing, club-level compliance, badges — and make My BG membership numbers a first-class field so a club can run both.

### ClassForKids (The Access Group) — the volume incumbent

Glasgow-origin kids' activity booking platform, "4,500+ clubs", acquired by Access Feb 2023; gymnastics customers include Dan Purvis GC, East Kilbride GC, Nottingham City GC. **No Direct Debit** (Stripe Billing card subscriptions, +0.5%, one plan per parent, no discount codes on subs — all verified in their help centre); waiting lists are manual invites and can't carry discounts; no badges, no DBS, no BG integration, **no customer export or API** (only financial reports and registers download); contacts deleted after a year's inactivity. Trustpilot 4.5 with 14% one-star — post-acquisition support decline, surprise charges, high fees. Strengths: Discovery marketplace lead-gen, parent app, brand.
**How to beat it:** Direct Debit (cheaper per payment _and_ no card-expiry churn), sibling pricing that works on subscriptions, auto waiting lists, compliance, and a migration path built on their financial-analysis and register exports.

### Thrive4 (formerly LoveAdmin) — the gymnastics-vertical incumbent

Pay Here Ltd rebranded LoveAdmin to Thrive4 with a **Thrive4Gymnastics** vertical and 19 named gymnastics customers (Thanet, Robin Hood 860+ gymnasts, South Devon, Evolve, Richmondshire Thirsk, Northwood…). True Direct Debit (GoCardless on v1, migrated to **London & Zurich**; current v2 provider unstated), pro-rata/instalments, generic award-scheme records, a **BG membership/insurance reconciliation** feature (mechanism unpublished), MemberHub app. **Pricing removed from the site** (consultative sell); reviews cite a £20k turnover minimum, ~£500 lost onboarding fees, v1→v2 migration pain, login/payment failures. CSV/TSV exports exist; DD mandates sit on a proprietary rail the club doesn't control.
**How to beat it:** published pricing, GoCardless in the _club's own_ account, cleaner UX, and a Thrive4 CSV importer.

### Class Manager (Class Manager Ltd, Exeter) — the most migratable

Dance-studio origin; gymnastics customers Impact, Torbay Olympic, Aberdeen Acrobatic. **£0 subscription, ~2.7% + 20p**, GoCardless DD with mandates in the club's own GoCardless account (importable by email match), auto discounts, family accounts, CSV/PDF exports. Waiting lists manual; no DBS; skills partial. Reviews: double-charging, app failures, slow support.
**Why it matters:** a Class Manager club can move to you by **taking over the same GoCardless organisation** — no re-mandating. Build that path early.

### Coacha (Gloucester) — the cheap GoCardless option

UK club software since 2014; gymnastics users Meadowbank GC, City of Manchester Institute of Gymnastics. Free ≤50 members, £36/mo Premium; **GoCardless DD 2.2% + 24p**; skills/badges tracking; safeguarding _notes_ vault (not DBS tracking); **no real waiting lists** (Jan 2026 review: "the system doesn't offer this"); app weaker than desktop.

### Gymnastify — the closest analogue

UK-made, gymnastics-only: badge ladders with auto-enrolment and certificates, auto-waitlists, digital registers, CSV import/export, GDPR; **Stripe only, no GoCardless**; £29.99/mo; **no named customers**. Validates your feature thesis; shows a Stripe-only entrant can't own the DD-billed recreational base.

### A2B Manager — tiny gymnastics-only vendor

15 named UK gym clubs (Colchester, Easton, Pipers Vale, Worthing, Fleet…); Stripe only; auto-fill waiting lists claimed; parent feedback on badges; Zapier. No published fees, no reviews, undisclosed ownership. Continuity risk is the pitch to its clubs.

### Fitronics CoursePro — the Rise benchmark

Leisure-centre-grade platform (Jonas/Gladstone group) that **built BG's Rise Hub** (admin, coach and home portals) and is BG's "official sports software supplier" (Sep 2021). Customers TIGERS, GymPlus, Basingstoke, Sudbury. Enterprise pricing, unpublished. **No third-party Rise API has been found** — assume a CSV bridge.

### The rest, briefly

**Spond** — free comms app + Spond Club; one gymnastics case study (Kingston Vale, 400 members); card-only 2.5% + 20p; manual waitlists. **Bookwhen** — generic booking with a few gymnastics users (Synergy, Axis, Majestic); proper CSV exports and a public API; no DD. **ClubRight** — gym-membership software with a gymnastics page but no named gym clubs; DD 40–45p flat; auto waiting-list offers. **Membermojo / Happity** — membership database / pre-school marketplace respectively; not class-billing competitors. **Pitchero / TeamUp / Playwaze** — no gymnastics evidence or wrong data model. **iClassPro / Jackrabbit / Uplifter / Sportlyzer** — US/CA/EE, USD/EUR pricing, no Bacs DD; iClassPro "retains database ownership" and deletes after 60 days — quote that.

---

## 7. Data portability — what the importers must read (TEM-23)

| Source                                | What a club can get out                                                                                                                                         | Importer priority           | Mandate story                                                                                                                              |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **DIY (GoCardless + Sheets / Forms)** | GoCardless CSV (customers, mandates, payments) + whatever the spreadsheet holds                                                                                 | **1 — easiest wins**        | **Take over the GoCardless org** — zero re-mandating                                                                                       |
| **Class Manager**                     | Student list + attendance CSV/PDF; GoCardless in club's own account                                                                                             | **1**                       | **Take over the GoCardless org**                                                                                                           |
| **ClassForKids**                      | Financial Summary / Analysis / Outstanding spreadsheets (parent, child, class, venue, day, amounts) + register downloads; **no family/customer export, no API** | **2 — biggest pool**        | Card mandates in Stripe Billing are **not portable** — every family re-mandates (this is also the pitch: DD is cheaper and doesn't expire) |
| **Thrive4 / LoveAdmin**               | Payment / contact reports as CSV / TSV / text with selectable fields                                                                                            | 2                           | DD on a proprietary rail (L&Z) — re-mandate, or Bacs bulk change via the provider                                                          |
| **Coacha**                            | Member CSV (import documented; export partially documented); safeguarding export                                                                                | 3                           | GoCardless — org takeover may be possible                                                                                                  |
| **Bookwhen**                          | Attendances, bookings, customers CSV + public API                                                                                                               | 3                           | No DD                                                                                                                                      |
| **JustGo for Clubs**                  | **Unpublished** for BG instance (British Rowing instance: "clubs can download membership data"); API/adaptors exist, not public                                 | 3 — verify with a real club | Unknown                                                                                                                                    |
| **Spond**                             | Member list + payment exports to Excel                                                                                                                          | 3                           | Card only                                                                                                                                  |

**Design rule:** build a **"GoCardless organisation takeover"** flow first (covers DIY, Class Manager, possibly Coacha) and a **spreadsheet mapper** second (ClassForKids, Thrive4). Together they cover the large majority of clubs.

---

## 8. Positioning — where the fork wins

The market splits into _free-but-generic_ (JustGo), _volume-but-card-only_ (ClassForKids), _vertical-but-opaque_ (Thrive4) and _DIY_. None of them owns the operations layer a volunteer-run club actually struggles with. Position as:

> **"The operations and compliance platform for gymnastics clubs — waiting list to enrolled, Direct-Debit-billed, safeguarding-compliant member in one click. Works alongside My BG."**

Six defensible wedges, in order of how hard they are to copy:

1. **GoCardless-native Direct Debit with pro-rata, sibling and multi-class rules, and mandate/organisation import.** ClassForKids and JustGo (as documented) can't; Thrive4's rail isn't the club's. Cheaper per payment than any card stack, no card-expiry churn. _(Inherited from Swimly.)_
2. **Club-level safeguarding compliance** — DBS / first-aid / coach-qualification expiry tracking and a welfare-officer dashboard. **Nobody ships it.** _(Inherited: `compliance/dbs`, `safeguarding`, `consents`.)_
3. **True auto-offer waiting lists** with time-boxed acceptance and priority rules (existing members first). Every major player is a manual invite. _(Extend `waitlist`.)_
4. **Badge progression as data** (Rise / Proficiency / club schemes) with badge-fee billing and a CSV bridge to Rise Hub — modelled on CoursePro, the only proven Rise integration.
5. **Published flat pricing + one-click full export + API** — a trust signal against opaque JustGo / Thrive4 / A2B fees, ClassForKids' export gap and iClassPro's "we own your database".
6. **"Works alongside My BG"** — first-class BG membership number, insurance/expiry reconciliation (Thrive4's one clever feature), so a club never has to choose between you and the NGB tool. Plus a **Sport:80 path for Wales**.

Pricing to test: a published flat monthly fee in the **£25–£35** band (free below a small member count) with **GoCardless pass-through at cost** — beats Coacha on DD rate, ClassForKids on total cost, and makes JustGo's "free" look expensive once its tiered fees land on £50/month DDs.

---

## 9. Risks and watch-list

- **JustGo adds Direct Debit and badges for BG.** It already uses GoCardless on other NGB instances; if it lights that up for BG and ships Rise, wedges 1 and 4 narrow. Mitigation: move fast on compliance and waiting lists (wedges 2–3), which sit outside an NGB platform's natural scope.
- **Access Group fixes ClassForKids** (DD, exports). Possible but slow; their recent trajectory is the opposite. Bank the migration window.
- **Thrive4 owns the gymnastics customer list.** Their weakness is trust (pricing, minimums, migration pain) — compete on transparency, not features.
- **Rise Hub stays closed.** Plan for CSV; lobby BG for an API once you have founding clubs — that conversation is easier with 10 clubs than 0.
- **Wales** needs Sport:80 awareness before you sell there.
- **Unverifiable:** JustGo fee tiers and adoption; Thrive4 pricing; A2B fees. Confirm with founding clubs during Phase 0/4 outreach — ask every prospect what they pay today.

---

## 10. Changes to the plan this implies

1. **Positioning statement and project description** — replace "vs class-booking incumbents" with the §8 statement; JustGo is the named alternative.
2. **TEM-14 / member model** — make the BG membership number a first-class, reconcilable field; add `governing_body` = Welsh Gymnastics (Sport:80) as a config entry when Wales is in scope.
3. **TEM-18 badges** — schemes-as-data + Rise CSV bridge (no API); badge-fee billing stays.
4. **TEM-22 waiting list** — spec time-boxed auto-offer with priority rules explicitly; it's the clearest gap in the market.
5. **TEM-23 importers** — reorder: GoCardless organisation takeover first, ClassForKids spreadsheet mapper second, Thrive4 CSV third.
6. **New:** a public **pricing + data-export promise** page on the marketing site (TEM-25), and a **"works alongside My BG"** integration note.

---

## Sources (consolidated)

**British Gymnastics / JustGo / Fitronics:** [BG: free JustGo for Clubs](https://www.british-gymnastics.org/articles/british-gymnastics-to-provide-clubs-with-free-use-of-new-justgo-for-clubs-class-management-system) · [JustGo official club solution (26 Aug 2025)](https://justgo.com/british-gymnastics-welcomes-justgo-as-its-official-club-solution/) · [JustGo for Clubs — BG page](https://justgo.com/justgo-for-clubs-british-gymnastics/) · [JustGo one year (30 Jul 2026)](https://justgo.com/one-year-of-progress-helping-british-gymnastics-clubs-thrive-with-justgo/) · [BG goes live on JustGo (Jul 2024)](https://justgo.com/british-gymnastics-goes-live-with-justgo/) · [JustGo pricing](https://justgo.com/pricing/) · [British Rowing ClubHub FAQs (JustGo fees/GoCardless)](https://www.britishrowing.org/knowledge/club-support/british-rowing-clubhub/faqs/) · [Fitronics × BG Rise](https://fitronics.com/news/british-gymnastics-and-fitronics-bring-rise-gymnastics-to-life) · [Fitronics gymnastics](https://www.fitronics.com/gymnastics-club-management-software/) · [BG Rise Hub](https://www.british-gymnastics.org/rise-gymnastics/rise-gymnastics-hub) · [Welsh Gymnastics on Sport:80](https://www.sport80.com/news/welsh-gymnastics-take-the-leap-to-transform-online-member-experience-with-sport-80) · [BG Membership Rules v13 (Jul 2025)](https://a.storyblok.com/f/83342/x/8507cce2d6/2025_07_11_membership_rules_v13-0_live.pdf)

**ClassForKids:** [pricing](https://www.classforkids.com/pricing/) · [gymnastics page](https://www.classforkids.com/industries/gymnastics-club-management-software/) · [subscriptions (card-only, +0.5%)](https://help.classforkids.io/en/articles/12753012-setting-up-and-managing-subscriptions-new-version) · [waiting lists](https://help.classforkids.io/en/articles/8100002-waiting-lists) · [financial exports](https://help.classforkids.io/en/articles/8486208-financials) · [Access Group acquisition](https://www.theaccessgroup.com/en-gb/about/news/the-access-group-acquires-classforkids-and-enters-the-kid-s-club-software-market/) · [Trustpilot](https://uk.trustpilot.com/review/class4kids.co.uk) · [Capterra](https://www.capterra.com/p/141287/Class4Kids/)

**Thrive4 / LoveAdmin:** [thrive4gymnastics.com](https://thrive4gymnastics.com/) · [product](https://thrive4gymnastics.com/gymnastics-club-management-software/) · [customer stories](https://thrive4gymnastics.com/customer-stories/) · [Richmondshire Thirsk (BG reconciliation)](https://thrive4gymnastics.com/customer-stories/richmondshire-thirsk-gymnastics-club/) · [GoCardless → L&Z migration](https://loveadmin.zendesk.com/hc/en-us/articles/360007904318-Migrating-GoCardless-Direct-Debits-to-London-and-Zurich) · [exports](https://loveadmin.zendesk.com/hc/en-us/articles/360018522352-Financials-Help) · [Capterra pricing](https://www.capterra.com/p/182986/LoveAdmin/pricing/) · [Trustpilot](https://uk.trustpilot.com/review/loveadmin.com)

**Class Manager:** [UK page](https://classmanager.com/gb) · [fees help](https://help.classmanager.com/en/stripe) · [GoCardless setup](https://help.classmanager.com/en/gocardless-getting-started-class-manager-help-center) · [waiting list](https://help.classmanager.com/en/waiting-list-class-manager-help-center) · [exports](https://help.classmanager.com/en/how-to-download-a-list-of-students-class-manager-help-center) · [Companies House](https://find-and-update.company-information.service.gov.uk/company/11687095) · [Trustpilot](https://uk.trustpilot.com/review/classmanager.com)

**Coacha:** [pricing UK](https://www.coacha.co.uk/Pricing/Pricing-UK) · [gymnastics](https://www.coacha.co.uk/Gymnastics-Club-Management-Software) · [safeguarding section](https://coachasupport.zendesk.com/hc/en-us/articles/4419273931537-Safeguarding-Section) · [Capterra reviews](https://www.capterra.com/p/166349/Coacha/reviews/) · [Companies House](https://find-and-update.company-information.service.gov.uk/company/05294974)

**Others:** [Gymnastify](https://gymnastify.co.uk/) · [A2B Manager](https://a2bmanager.com/) · [Bookwhen CSV](https://support.bookwhen.com/en/articles/2614578-exporting-data-to-csv-files) · [ClubRight pricing](https://clubright.co.uk/pricing/) · [Membermojo pricing](https://membermojo.co.uk/mm/pricing) · [Happity pricing](https://providers.happity.co.uk/pricing/) · [Spond fees](https://help.spond.com/club/en/articles/58192-what-is-the-transaction-fee-in-spond-club) · [Spond waitlist](https://help.spond.com/club/en/articles/284915-how-the-waitlist-feature-works-in-spond-club) · [Spond × Kingston Vale](https://www.spond.com/news-and-blog/spond-case-study-kingston-vale-gymnastics-cheer/) · [TeamUp](https://goteamup.com/product/club-management-software/) · [Pitchero fees](https://help.pitchero.com/knowledge/pitchero-club-website/payment-tools/uk-transaction-fees) · [Playwaze pricing](https://business.playwaze.com/pricing) · [GoCardless pricing](https://gocardless.com/pricing/) · [iClassPro pricing](https://www.iclasspro.com/pricing) · [iClassPro FAQs (data ownership)](https://www.iclasspro.com/iclasspro-faqs) · [Jackrabbit pricing](https://www.jackrabbitclass.com/pricing/) · [Jackrabbit cancellation](https://help.jackrabbitclass.com/help/cancel-your-jackrabbit-subscription) · [Uplifter](https://www.uplifterinc.com/top-sports/gymnastics) · [Sportlyzer pricing](https://www.sportlyzer.com/en/pricing)

**Market:** [Fetchify (400k members)](https://www.fetchify.com/fetchify-supports-the-400-000-strong-membership-of-british-gymnastics) · [Sports Management (2017: 1M waiting list)](https://www.sportsmanagement.co.uk/Sports-features/sports-management-magazine/Gymnastics-On-a-roll/31854) · [Better Society Capital / Club Capital](https://bettersocietycapital.com/portfolio/amateur-british-gymnastics-investments-limited-club-capital/) · [BG parliamentary evidence](https://committees.parliament.uk/writtenevidence/135101/pdf/) · [Sport England Active Lives CYP](https://www.sportengland.org/news-and-inspiration/childrens-activity-levels-hold-firm-significant-challenges-remain) · fee samples: [Cheshire](https://cheshiregymnastics.com/wp-content/uploads/2026/02/Recreational-Pricing-Policy-April-2026-final.pdf), [Treasure](https://www.treasuregymnastics.co.uk/club-prices), [Notts GA](https://www.nottsgymnasticsacademy.co.uk/index.php/recreational/gfa-classes/our-weekly-class-fees), [Corby (GoCardless direct)](https://www.corbygymnastics.co.uk/payment.html)
