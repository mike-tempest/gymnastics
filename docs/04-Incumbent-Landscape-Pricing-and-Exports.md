# Incumbent Landscape, Pricing and Export Formats

_Prepared 5 September 2026 (TEM-7). Confirms the incumbent tools UK gymnastics clubs actually use, their pricing, payment rails, data-export capability and waiting-list handling, so that (a) TEM-23 data-import mappers target real export formats and (b) pricing can be positioned. All pages accessed 5 September 2026 unless noted. Vendor pricing and help pages are preferred as sources; anything not confirmable from a current primary source is flagged **[unverified]**. Several vendor pages (classforkids.com, Happity, LoveAdmin's legacy Zendesk) block automated fetching; where a fact comes from a search-result rendering of the vendor's own page rather than a direct page load it is flagged **[via search snippet]**._

---

## Summary comparison

| Incumbent               | Focus / segment                                                | Pricing (software)                                    | Payments take                                                             | Direct Debit        | Export capability                                             | Waitlist strength                                             |
| ----------------------- | -------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- |
| **ClassForKids**        | Class booking + payments for kids' activity clubs; rec classes | £34.99/mo (UK)                                        | Per-booking platform fee, unpublished (one club published 3.1%) + Stripe  | No (recurring card) | Per-screen spreadsheet exports (financials, contacts); no API | Real: per-class list, manual one-click invite                 |
| **JustGo for Clubs**    | BG's official club solution; membership + classes              | Free subscription                                     | Tiered transaction fees, unpublished                                      | _[unverified]_      | _[unverified]_; holds every BG club's member data             | Class-specific and club-wide waitlists (mechanics unverified) |
| **LoveAdmin (Thrive4)** | Full club/membership management; clubs with squads             | Quote-led (historically from ~£20-£35/mo + setup fee) | Historically ~3% of processed income + provider fees _[secondary source]_ | Yes (GoCardless)    | Contact export to CSV with selectable fields/groups           | _[unverified]_                                                |
| **Coacha**              | General club management (members, attendance, safeguarding)    | Free (Lite), £36/mo (Premium), £60/mo (Custom)        | Card 2.5% + 20p incl Stripe; DD 2.2% + 24p incl GoCardless                | Yes (GoCardless)    | People > Import/Export spreadsheet _[partially verified]_     | Waitlists for existing classes; more in development           |
| **A2B Manager**         | Gymnastics-specific club platform (UK)                         | "No monthly fees"; platform fee by club size, POA     | Unpublished; Stripe-powered                                               | _[unverified]_      | "Data export functionality" claimed, undocumented             | Marketed as automatic fill of empty spaces                    |
| **Class Manager**       | Class-based clubs (dance/gymnastics); free software            | £0/mo                                                 | 1% incl VAT per transaction (Stripe or GoCardless) + provider fees        | Yes (GoCardless)    | _[unverified]_                                                | _[unverified]_                                                |
| **Happity**             | Baby/toddler class marketplace + bookings (preschool only)     | From £5/mo (+£10/mo featured) _[via search snippet]_  | 2.5% + VAT per booking + Stripe 1.5% + 20p _[via search snippet]_         | No                  | Bookings CSV export incl marketing opt-in; register PDF       | None found _[unverified]_                                     |
| **Gymcatch**            | Class/session booking for sport and fitness businesses         | From £10 + VAT/mo; £2 + VAT bolt-ons                  | None of its own; processor fees only                                      | Yes (GoCardless)    | Reports, customer and registration info to CSV                | Automated waitlists in core plan                              |
| **Pembee**              | Activity/class booking (UK)                                    | £30/mo (Standard), £70/mo (Premium)                   | 0.59% application fee + Stripe fees                                       | Not mentioned       | Bookings/users/attendees CSV or PDF                           | Premium plan only                                             |
| **iClassPro**           | US gymnastics-school heavyweight; some UK clubs                | From $139/mo (USD)                                    | Processor-dependent                                                       | US-centric rails    | Strong: filterable reports to CSV/XLS (family, student lists) | Exists _[unverified]_                                         |
| **Jackrabbit Class**    | US class management; minimal UK gymnastics presence            | From $49/mo (USD), scales by student count            | Processor-dependent                                                       | US-centric rails    | _[unverified]_                                                | _[unverified]_                                                |

---

## 1. ClassForKids

**The most-seen incumbent in the wild.** Four of the thirteen clubs on the founding-club shortlist (Be… Gymnastics, Tyneside, Scarborough, Bristol Hawks) run on it (see `docs/02-Founding-Club-Shortlist.md`).

- **Focus and segment.** Class booking, registers and payments for children's activity clubs. Term-based classes with per-class capacity; also subscriptions. It is booking-and-billing software for recreational classes, not squad/competition management.
- **Pricing.** UK plan **£34.99/mo** (EU €39.99, US $49.99, AU/NZ $69.99); "No setup fees or hidden fees", unlimited users. VAT treatment not stated on the pricing page **[unverified]**. Source: https://classforkids.webflow.io/pricing (the vendor's own Webflow-hosted pricing page; classforkids.com blocks automated access), accessed 5 September 2026. On top of the subscription there is a **per-booking platform fee that ClassForKids does not publish**; it says the rate depends on business size and payment volume. One UK club's parent FAQ (January 2024) itemised it at **3.1%**, with **Stripe card processing of 1.5% + 20p** as a separate line. Recurring subscription payments carry a further **0.5% Stripe Billing fee** (reduced from Stripe's standard 0.7%) which the club absorbs. Sources: https://www.bizzly.net/guides/classforkids-pricing (secondary, updated 31 July 2026); https://help.classforkids.io/en/articles/7826740-setting-up-and-managing-subscriptions **[via search snippet]**.
- **Payment rails.** Stripe throughout; the club manages its own Stripe account (https://help.classforkids.io/en/articles/8469237-managing-your-stripe-account), so the merchant relationship is the club's. **No bank Direct Debit**: subscriptions are recurring card payments the vendor describes as "similar to direct debit". Childcare vouchers are handled as offline payments (https://help.classforkids.io/en/articles/9630450-taking-payment-with-childcare-vouchers).
- **Data export (TEM-23 critical).** No single "export everything" function is documented. Exports are per-screen spreadsheets:
  - **Financials**: Summary tab > Export produces a spreadsheet with date/time, amount, payment method, payment type, transaction number, fees charged and income columns. Source: https://help.classforkids.io/en/articles/8486208-financials.
  - **Contacts**: from the Schedule page, "Send Messages or Export" compiles the contacts for selected classes; field-level columns are not documented **[unverified]**. Source: https://help.classforkids.io/en/articles/8016088-how-to-send-emails-to-parents-and-carers.
  - **Registers**: can be exported and printed for coaches (https://classforkids.io/clubs/features/parent-communication).
  - **No public API found** **[unverified]**.
- **Waiting list.** A real feature, and better than folklore suggests: when a termly class reaches capacity, parents join a waitlist through the same flow (child details plus registration questions), the list sits on the class register ordered by join date, and the admin invites the next parent with one click; the parent gets an email to confirm or decline, and a decline notifies the club. It is still **per-class and manually triggered**: no automatic offer cascade, no age/priority rules, no cross-class matching. Sources: https://help.classforkids.io/en/articles/8100002-waiting-lists; https://classforkids.io/clubs/features/bookings.
- **Switching friction.** Contract length and notice period are not published **[unverified]**. Data lock-in is moderate: contact and financial data can be pulled out screen by screen, but there is no consolidated export and no API, so a departing club re-assembles its records from several spreadsheets.

## 2. JustGo for Clubs (British Gymnastics' official club solution)

Not on the original ticket list, but unavoidable: **British Gymnastics selected JustGo as its membership management platform** (replacing GymNET; member portal at https://mybg.british-gymnastics.org), and JustGo markets **JustGo for Clubs** as the "official" BG club solution with a **free subscription and tiered transaction fees**. Sources: https://www.british-gymnastics.org/articles/british-gymnastics-partners-with-justgo; https://justgo.com/british-gymnastics-selects-justgo-as-its-membership-management-platform/; https://justgo.com/justgo-for-clubs-british-gymnastics/.

- **Focus and segment.** NGB membership plus club management: memberships (seasonal, rolling, annual), class scheduling, attendance via app, medical records, communications, one-off/recurring/pay-as-you-go payments, financial reporting.
- **Pricing.** "Free Subscription" with "Tiered Transaction Fees"; the tier numbers are not published **[unverified]**.
- **Payment rails.** Card and recurring payments advertised; whether Direct Debit is offered and who holds the merchant account is not stated **[unverified]**.
- **Data export.** Not documented publicly **[unverified]**. Strategically more important: **every BG-registered club already has its member roster in the BG/JustGo system**, because individual BG membership is a condition of club registration (see `docs/01-British-Gymnastics-Compliance-Brief.md`). Whatever export JustGo gives club admins is the one import source common to all target clubs, and it is authoritative for BG membership numbers.
- **Waiting list.** "Offer class-specific or club-wide waitlists"; mechanics (automation, offer flow) undocumented **[unverified]**.
- **Switching friction.** Free-subscription pricing endorsed by the NGB makes JustGo the default gravity well for new clubs; expect to compete on product depth (waitlist automation, billing) rather than price.

## 3. LoveAdmin (rebranding to Thrive4)

- **Focus and segment.** Full membership management (formerly PaySubsOnline): registration, subs collection, invoicing, communications, reporting. Historically pitched at clubs with meaningful throughput, including a dedicated gymnastics vertical (https://loveadmin.com/who-we-help/gymnastics-club-management-software/, now redirecting). Suits clubs with squads and monthly subs more than drop-in bookings.
- **State of play.** In 2026 LoveAdmin is rebranding to **Thrive4**; loveadmin.com (including its pricing page) now redirects to https://thrive4.com, which publishes **no pricing** and is quote-led via demo. Existing customers still log into "LoveAdmin v1". Confirmed by direct fetch of both domains, 5 September 2026.
- **Pricing.** Current numbers unpublished **[unverified]**. Historical reference points: Capterra lists LoveAdmin from **£20.00/mo, usage-based** (https://www.capterra.com/p/182986/LoveAdmin/pricing/); a competitor guide describes **from £35/mo plus a setup fee plus ~3% of each transaction plus Stripe fees** (https://www.pembee.app/blog/the-best-gymnastics-management-software-for-2026, secondary source, treat with caution).
- **Payment rails.** Direct Debit is core: LoveAdmin is a **GoCardless partner** (https://gocardless.com/partners/love-admin), with weekly collection retries for DD; its help centre also documents a historical migration of some clubs to **London & Zurich** for DD (https://loveadmin.zendesk.com/hc/en-us/articles/360010110957) and PayPal/GoCardless coexistence.
- **Data export (TEM-23 critical).** The legacy platform has a proper contact export: choose groups ("Export members from these groups"), choose fields and/or statements via a View dropdown, then Export to a **CSV** delivered to the browser. Source: https://loveadmin.zendesk.com/hc/en-us/articles/360017407972-How-Do-I-Export-Contact-Data (article blocked to automated fetch; steps **[via search snippet]** of the vendor's own article). The new Thrive4 help centre's Contacts page documents column management and filtering but no export article was found for the new platform **[unverified]** (https://help.thrive4.com/contacts-overview).
- **Waiting list.** No public documentation found **[unverified]**.
- **Switching friction.** Quote-led pricing, a setup fee, and a mid-rebrand platform migration of its own. Clubs unsettled by the LoveAdmin-to-Thrive4 transition are a plausible switching audience.

## 4. Coacha

- **Focus and segment.** UK (Manchester) general club management: member records, attendance registers, comms, payments, safeguarding-oriented features; markets a gymnastics page (https://www.coacha.co.uk/Gymnastics-Club-Management-Software). Fits committee-run clubs; not a parent-facing booking marketplace.
- **Pricing.** From https://www.coacha.co.uk/Pricing/Pricing-UK, accessed 5 September 2026: **Coacha Lite free; Premium £36/mo; Custom £60/mo; Custom Plus POA** (a 50% first-3-months promotion showed £18/£30 at access time). The page does not state whether subscription prices include VAT **[unverified]**. "You're free to cancel at any time."
- **Payment rails.** Both rails, with all-in published fees: **cards 2.5% + 20p per transaction ("no VAT applicable and this INCLUDES Stripe fees")**; **Direct Debit 2.2% + 24p per transaction ("VAT included and this INCLUDES GoCardless fees")**. Cash, BACS and standing orders recorded free of charge. SMS via Twilio at 4.9p per text. GoCardless tracks DD payments automatically into Coacha's dashboard (https://gocardless.com/partners/coacha/).
- **Data export.** People > Import/Export in the navigation handles member data both ways; the import spreadsheet is downloadable and member data is managed in CSV form (https://coachasupport.zendesk.com/hc/en-us/articles/360007311952-Using-Coacha-s-Mass-Member-Upload). Field-level export documentation not found **[unverified]**.
- **Waiting list.** Waitlists exist for existing classes/sessions, with waitlists for unlaunched sessions and club joining described as in development (https://www.coacha.co.uk/More/Feature-Updates **[via search snippet]**).
- **Switching friction.** Low: monthly billing, cancel any time, free tier.

## 5. A2B Manager

- **Focus and segment.** The only incumbent on the list built **specifically for gymnastics clubs** (https://a2bmanager.com/): classes, terms, pay-as-you-go, parties and holiday camps, trials, parent feedback on skills/progress, merchandise shop. Used by Easton Gymnastics on the founding-club shortlist.
- **Pricing.** "No Monthly Fees"; "Platform Fees Dependent on Club Size", price on application; Enterprise plan quoted. No numbers published **[unverified]**. Free 7-day trial, free migration, setup and training. Source: https://a2bmanager.com/pricing/.
- **Payment rails.** "Automated payments powered by Stripe" (https://a2bmanager.com/features/). Direct Debit support not stated **[unverified]**.
- **Data export.** The site claims data export functionality; formats and scope are undocumented **[unverified]**. A **Zapier integration** (Mailchimp, Google, Facebook, Slack, Stripe) is the only documented programmatic route out.
- **Waiting list.** The strongest marketing claim in the field: "Automatically manage waiting lists and fill empty spaces as soon as they become available." Mechanics (offer rules, priorities, billing hand-off) are not documented, so the depth of the automation is **[unverified]**.
- **Switching friction.** Percentage-of-revenue pricing scales with club size; no published fees means no comparability. As the gymnastics-specific incumbent it is the closest direct competitor and worth a hands-on trial before Phase 3.

## 6. Class Manager

Added as genuinely relevant: UK product with a dedicated gymnastics vertical (https://classmanager.com/gymnastics-management-software).

- **Focus and segment.** Class-based clubs (dance schools and gymnastics): scheduling, registers, invoicing, parent portal.
- **Pricing.** **Free software, no monthly subscription**; revenue comes from a **1% (including VAT) fee per transaction** on top of provider fees, for both **Stripe** card payments and **GoCardless** Direct Debit. High-volume clubs get tailored pricing. Sources: https://classmanager.com/prices; https://help.classmanager.com/en/stripe.
- **Payment rails.** Stripe (cards) and GoCardless (Direct Debit); provider fees are the club's and vary by country.
- **Data export / waiting list.** Not verified in this pass **[unverified]**.
- **Switching friction.** Free-plus-percentage undercuts subscription incumbents at the small end; another reason not to compete on being cheap.

## 7. Happity

- **Focus and segment.** A **marketplace and booking system for baby and toddler classes**, not club management. Relevant only for the preschool programme edge of gymnastics clubs (Wickers on the shortlist uses it for preschool booking). Blocks, terms, drop-ins, trials, siblings, discount codes.
- **Pricing.** **From £5.00/mo**, plus **2.5% + VAT commission per booking**, plus **Stripe processing at 1.5% + 20p**; featured listing **£10.00/mo**. Sources: https://support.happity.co.uk/en/articles/2381444-pricing-commission-and-fees and https://providers.happity.co.uk/pricing/ (both blocked to automated fetch; figures **[via search snippet]** of those vendor pages, corroborated by https://www.softwareadvice.com/event-booking/happity-profile/).
- **Payment rails.** Stripe cards only; no Direct Debit.
- **Data export.** Customers > Bookings > **Export CSV** of everyone who has booked, including marketing opt-in status; registers export to PDF, plus contact phone/email lists per event. Sources: https://support.happity.co.uk/en/articles/2443933-happity-bookings-created-for-you; https://support.happity.co.uk/en/articles/8058268-how-to-view-your-registers **[via search snippet]**.
- **Waiting list.** No waitlist feature found in help centre or feature pages **[unverified]**.
- **Switching friction.** Low contractual friction; the marketplace listing (discovery of new parents) is the sticky part, and a club can keep Happity for discovery while running operations elsewhere (https://support.happity.co.uk/en/articles/6082082-i-have-my-own-booking-system-can-i-still-use-happity).

## 8. Gymcatch

- **Focus and segment.** Despite the name, primarily fitness/class businesses; sold to sports clubs too. Booking, scheduling, customer management.
- **Pricing.** **From £10 + VAT/mo** ("1 month free... Cancel anytime"), with **£2 + VAT/mo bolt-ons** (courses/blocks, memberships, discount codes, website integration). No commission of its own; "excludes processing fees". Source: https://gymcatch.com/pricing/.
- **Payment rails.** Three processors: **GymcatchPay (Unipaas, UK), Stripe and GoCardless**, so Direct Debit is available and the club holds the processor relationship.
- **Data export.** Reports, customer information and registration information export to **CSV**; purchase history has a dedicated Export to CSV. Sources: https://support.gymcatch.com/en/articles/4757230-customers; https://support.gymcatch.com/en/articles/4759392-how-do-i-add-and-onboard-migrate-my-customers (documents CSV import needing first name, last name, email as separate columns).
- **Waiting list.** **Automated waitlists included in the core plan** (listed on the pricing page's included features).
- **Switching friction.** Low: monthly, cancel anytime, CSV out.

## 9. Pembee

- **Focus and segment.** UK activity and class booking (clubs, camps); markets to gymnastics via content but is a booking system rather than club management.
- **Pricing.** **Standard £30/mo, Premium £70/mo**, 30-day free trial; **0.59% application fee** on Stripe online payments in addition to Stripe's own fees. VAT treatment not stated **[unverified]**. **Waitlists are Premium-only**, as are Zapier and monthly reports. Source: https://www.pembee.app/pricing.
- **Payment rails.** Stripe (plus Apple Pay/Google Pay/Klarna). Direct Debit not mentioned.
- **Data export.** Bookings, user information and attendee lists download as **CSV** (or PDF rosters). Source: https://help.pembee.app/article/64-export-as-csv.
- **Waiting list.** Present but paywalled behind the £70/mo tier.
- **Switching friction.** Low.

## 10. iClassPro and Jackrabbit Class (US heavyweights, marginal UK presence)

- **iClassPro** is the dominant US gymnastics-school platform and has some UK gymnastics clubs (e.g. Truro Gymnastics Club bills through it, https://www.trurogymnasticsclub.co.uk/fees). Pricing is USD-only: **from $139/mo** (Elite $199, Premium $299), branded app add-on $499 setup + $150/mo (https://www.iclasspro.com/iclasspro-pricing via search results **[via search snippet]**). Its **export story is the strongest in the field**: a large report catalogue (Family List FAM-1, Student List STU-1, custom family lists) exportable to **HTML/PDF/XLS/CSV** with rich filters (https://support.iclasspro.com/hc/en-us/articles/218570358-Which-Reports-are-Available). Payment rails are US-centric. A UK club leaving iClassPro can hand over clean CSVs.
- **Jackrabbit Class** (gymnastics vertical at https://www.jackrabbitclass.com/gymnastics/) starts at **$49/mo USD** scaling by student count. No meaningful UK gymnastics footprint was found on the shortlist or in searches; include in mappers only if a real prospect turns up with it **[unverified]**.

## Not included

- **Sport:80** builds platforms for NGBs (Welsh Gymnastics is a client, https://sport80.com/uk/clients), not club-management software sold to BG clubs; it is not a switching source for our target clubs. British Gymnastics itself chose JustGo (see section 2).
- **DIY tooling** (Google Forms, Cognito, Jotform, Wufoo + spreadsheets) is not an incumbent product but is the **most common "system" on the founding-club shortlist**; its export format is whatever CSV the form tool produces.

---

## Implications

### Export formats TEM-23 mappers should target, ranked

1. **Generic CSV mapping (forms and spreadsheets).** The shortlist shows more clubs on Google Forms/Jotform/Wufoo/Cognito exports and hand-rolled spreadsheets than on any single incumbent. A column-mapping import UI (CSV in, map to Member/guardian/class fields) is the base case and also absorbs every vendor CSV below.
2. **ClassForKids contact and financial spreadsheets.** Most-seen incumbent among target clubs; its exports are fragmented per-screen spreadsheets (contacts via "Send Messages or Export", financials via Summary export), so the mapper should accept several small files per club rather than one canonical dump. Obtain real sample exports from a founding club early; column layouts are not publicly documented.
3. **JustGo / British Gymnastics member data.** Every BG-registered club has its roster there, and it is the authoritative source of BG membership numbers (our `registrationNumberLabel`). Confirm what a club admin can download from JustGo as soon as we have a friendly club with access; format currently **[unverified]**.
4. **LoveAdmin contact CSV.** Field-selectable group export from the legacy platform; the Thrive4 rebrand may shake loose exactly the mid-size clubs this export serves.
5. **Coacha member spreadsheet** (People > Import/Export), then **Happity bookings CSV** (preschool programmes only) and **Gymcatch/Pembee CSVs** opportunistically; **iClassPro FAM-1/STU-1 CSVs** if a larger ex-iClassPro club appears.

### Pricing positioning

- **The market anchors software at £0 to £70/mo** (free tiers from Coacha, Class Manager and BG-endorsed JustGo; ClassForKids at £34.99; Pembee Premium at £70) **with a payments take of roughly 1% to 3.1% on top of processor fees**. Any subscription we set will be read against those anchors, and "free" competitors mean we cannot win on price alone: the waiting-list-to-enrolment automation has to carry the value story.
- **Direct Debit is our structural cost advantage.** Card-first incumbents (ClassForKids, Happity, Pembee, A2B) put clubs on ~2.9% to 3.6%+ effective card economics for recurring fees; GoCardless-based DD undercuts that materially, and Coacha's all-in DD rate (2.2% + 24p) is the published benchmark to beat. Lead with "monthly fees by Direct Debit, not by card".
- **Avoid unpublished percentage-of-revenue pricing.** ClassForKids, A2B, LoveAdmin/Thrive4 and JustGo all hide their transaction take behind quotes or tiers, which volunteer treasurers dislike and which penalises growing clubs. Publishing flat, VAT-inclusive pricing with pass-through processor fees is a differentiator in itself.
- **Do not paywall the waiting list.** The market either gates waitlists behind a premium tier (Pembee, £70/mo) or ships list-plus-manual-invite (ClassForKids). Our wedge is the automation depth (auto-offer by age/class/priority straight into billing and registers), so the waitlist itself must be in every plan.
- **Watch JustGo.** A free, NGB-endorsed subscription with club-wide waitlists is the incumbent to displace at new clubs; the pitch against it is product depth and billing automation, not price.

## Sources not linked inline

- https://www.capterra.co.uk/software/141287/class4kids (ClassForKids overview, secondary)
- https://www.bizzly.net/guides/classforkids-alternatives (market overview, secondary)
- https://justgo.com/one-year-of-progress-helping-british-gymnastics-clubs-thrive-with-justgo/ (JustGo/BG rollout status)
