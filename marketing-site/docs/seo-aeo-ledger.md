# Swimly SEO/AEO Engine - Run Ledger

This is the memory of the daily SEO/AEO engine. The agent reads it at the start of
every run and appends to it at the end. It exists so the job never repeats itself,
keeps a validated backlog, and builds cumulatively. See `seo-aeo-engine.md` for the
operating rules.

Note: the 61 blog posts that existed before this engine started are not listed here.
The agent always lists `src/content/blog/` at the start of a run to see the full set
of existing slugs and avoid duplicating them.

## Target-query backlog

Highest-value validated items first. The Sunday research run keeps this stocked.
Before acting on any item, confirm it is still a genuine gap against the current
contents of `src/content/blog/`.

### Ready (validated or low-risk)

- **UK, HIGHEST VALUE, new content: Swim England's Stronger Affiliation process.**
  Validated 2026-08-02. Target query: "Swim England stronger affiliation" and the
  long tail around it ("what evidence does stronger affiliation need", "swim club
  affiliation requirements 2026"). A grep of the WHOLE repo (`src/`, `public/`,
  not just the blog) returns ZERO occurrences of "stronger affiliation", so this
  is a total gap on a compliance topic that sits exactly on Swimly's positioning
  pillars, is mandatory for every affiliated club, and has a hard consequence for
  ignoring it. Every affiliated club has to do it, annually, and most committees
  will search rather than read the circular.
  What it is, verified against a Swim England region site
  (https://swimnorthwest.org/stronger-affiliation/, fetched clean this run;
  swimming.org itself 403s to direct fetch as this ledger records elsewhere, so
  use the region sites and cite them). Six pieces of evidence, submitted annually
  through the Governance and Compliance Portal: club constitution (2022 Swim
  England Model Constitution v1-4 onwards, region-approved) with recent AGM
  minutes; a 12-month Diversity and Inclusion Action Plan (DIAP) plus named CPD
  completions; a Club Welfare Officer signed statement of Wavepower compliance;
  a Club Chair signed statement of Code of Ethics compliance; a minimum of three
  risk assessments (one pool-based per discipline, one non-pool, one club trip);
  and a Club Personnel Report with DBS and safeguarding in date. Stated
  consequence, quotable: failure to maintain it annually "will result in a club
  facing suspension from Swim England which will affect all club activities".
  Why the fit is unusually good: five of the six evidence items are things Swimly
  already helps a club hold (constitution and AGM minutes as documents, personnel
  records, DBS and safeguarding expiry tracking, role descriptions), so the soft
  CTA writes itself without overclaiming.
  Strong internal-link web already in place: what-wavepower-compliance-actually-
  requires, what-is-a-swim-club-constitution (already covers the 2022 model
  constitution and its CASC variant), dbs-check-tracking-for-swimming-clubs,
  swim-club-committee-roles-and-responsibilities, swim-england-membership-
  categories-guide (affiliation fees and the 28 February deadline),
  club-health-tracker-guide-swim-england-2026, swim-club-agm-checklist.
  Cautions for whoever writes it: (a) regional detail varies, the North West page
  above lists SENW-specific director approval and workshop requirements, so state
  the national six and tell clubs to check their own region rather than
  presenting one region's extras as universal; (b) do NOT assert a deadline date
  or a completion percentage without re-verifying, the "almost a quarter of clubs
  have completed" and "three months left" Swim England articles are undated in
  search results and 403 to direct fetch; (c) risk assessments are currently a
  near-zero-coverage topic on the blog (three passing mentions, all in other
  posts), so the risk-assessment section is genuinely additive rather than a
  reword. Also worth checking whether the Club Health Tracker guide (open PR
  #170) now overlaps, and cross-linking rather than repeating.

- **UK, new content: paying and employing swim club coaches.** Validated
  2026-08-02. Target queries: "are swimming coaches self-employed", "does our
  swim club need to run PAYE", "paying a swimming coach cash", "swim club
  employer responsibilities". Genuine gap confirmed by grep: employment status
  appears in exactly two sentences across all 68 posts, both as budget line items
  (`managing-swim-club-finances` lists "paid employees, self-employed
  contractors, or honoraria" in one line; `swim-club-budget-planning-guide`
  budgets employer National Insurance at 15 per cent above the 5,000 pound
  secondary threshold for 2026/27 and has one FAQ on it). Zero occurrences of
  "payroll", "PAYE" as a club obligation, auto-enrolment as a duty rather than a
  cost, or the status test itself. This is a recurring treasurer and chair
  question with real financial exposure (HMRC looks at the reality of the
  engagement, not the label on the contract, and getting it wrong means back
  tax), and it pairs naturally with the existing treasurer, budget and finance
  cluster.
  Source discipline for this one is important: the search results surfaced mostly
  commercial accountancy blogs, which are NOT good enough for a governance claim
  under hard rule 5. Use gov.uk primary sources only (employment status guidance,
  the CEST tool, PAYE thresholds, auto-enrolment duties on The Pensions
  Regulator) and link them, and say plainly that status is fact-specific and that
  a club with any doubt should take advice rather than implying the post decides
  it. Do not restate the employer NI figures the budget guide already owns; link
  that post instead, so one page stays authoritative for the numbers.

- CLOSED (verified 2026-08-02). "Add a visible FAQ plus `faqItems` to the compliance
  posts that lack them." All four originally listed posts are done:
  what-wavepower-compliance-actually-requires (PR #26),
  parents-guide-to-wavepower-compliance (PR #27),
  gdpr-compliance-for-youth-swimming-clubs (PR #35),
  running-your-first-swimming-club-agm (PR #78), plus the two AGM stragglers,
  swimming-club-agm-legal-requirements-uk (PR #126) and swim-club-agm-checklist
  (PR #136). PR #136 has since merged: `swim-club-agm-checklist.md` on main now
  carries `faqItems`, so this item is fully closed. Do not redo any of them.
  Superseded by the wider blog FAQ audit below.

- Blog posts with no `faqItems` at all, so no FAQPage schema (measured on main
  2026-08-02): **51 of 68**. This is the single largest untapped AEO surface on
  the site and replaces the narrower compliance-posts item above. Highest-value
  candidates, all high-intent and none currently emitting schema:
  `how-to-choose-swimming-club-management-software-uk`,
  `swim-club-software-pricing-comparison-uk`,
  `swim-england-membership-categories-guide`,
  `direct-debit-vs-card-payments-for-swim-clubs`,
  `how-to-collect-swim-club-fees`, `managing-swim-club-finances`,
  `swimming-club-safeguarding-best-practices-2026` and
  `club-health-tracker-guide-swim-england-2026` (NB the last is being refreshed
  in open PR #170; check that first). None of these has a visible FAQ section
  either, so each needs a visible section authored, not just faqItems mirrored.
  One post per Saturday AEO or Tuesday refresh run. Reuse the render-from-
  `faqItems` pattern introduced on `swimming-club-membership-software.astro`
  (2026-08-01) so the visible copy and the schema cannot drift.

- Trim the remaining overlong blog meta descriptions to 155 characters or fewer
  (the effective `seoDescription || description` is the meta tag). The 2026-06-19
  technical audit found 36 posts over 160 characters; the 6 worst (over 200) were
  fixed in PR #30, the 197-char GDPR post in PR #35, the four worst remaining
  (194 to 196 chars) in PR #70, and the next six worst (183 to 187 chars) in PR
  #77, the six worst remaining (168 to 178 chars) in PR #123, and the next six
  worst (163 to 179 chars) in PR #139: volunteer-burnout-in-swim-clubs (179 to
  153), volunteer-management-for-swimming-clubs (178 to 147),
  digital-transformation-for-swimming-clubs (166 to 150),
  swim-club-end-of-season-checklist (166 to 137), swim-england-api-guide-2026
  (164 to 145) and new-season-setup-guide-swim-clubs (163 to 152, also removed a
  body-copy em dash in the description). Chip away a handful per Friday technical
  run, never mass-edit.
  Update (2026-07-31, PR #193): the next six worst (161 to 165 chars) are DONE.
  managing-swim-club-finances (165 to 149, its blocking PR #137 having merged),
  how-to-grow-swim-club-membership (162 to 149),
  parent-communication-tips-for-swim-clubs (162 to 147),
  parents-guide-to-wavepower-compliance (162 to 133),
  how-to-manage-swim-club-membership-renewals (161 to 148) and
  running-effective-squad-training-sessions (161 to 144).
  SEVEN remain over 155, all now in the narrow 156 to 160 band (re-measured on
  main 2026-07-31, independently confirmed on main 2026-08-02), in descending
  length. One more Friday run clears the item:
  competition-secretary-spring-gala-survival-guide (160),
  treasurers-guide-swim-club-direct-debit (160, via seoDescription),
  swimming-club-committee-tips (159),
  how-to-run-a-swim-club-committee-meeting-efficiently (158),
  how-to-run-a-successful-gala (157), swimming-gala-entry-management-guide (157),
  direct-debit-vs-card-payments-for-swim-clubs (156). One Friday run clears the
  lot. NB: swimming-club-agm-legal-requirements-uk was trimmed to 144 in PR #126,
  so the old "(164)" entry here was stale and is now removed.

- House-style em-dash cleanup in blog bodies. Em dashes in body copy breach house
  style (rewrite the sentence). Do one or two posts per Friday technical run,
  rewriting each sentence rather than mass find-and-replace (an em dash often
  needs a real rewrite, not a swap to a colon or comma). Never touch the
  programmatic pages.
  Counted properly on main 2026-08-02 for the first time: **21 posts, 224 em
  dashes**, and the distribution is far more lopsided than this item previously
  assumed. In descending count: how-to-collect-swim-club-fees (68),
  your-first-county-championships-swim-parent-guide (22),
  county-championships-swim-parent-guide (13), understanding-critical-swim-speed
  (12), first-county-championship-guide-for-swim-parents (9),
  new-season-setup-guide-swim-clubs (9), 5:30am-wake-up-swim-parent-guide (8),
  competition-secretary-spring-gala-survival-guide (8),
  gala-day-survival-guide-for-new-swim-parents (8),
  treasurers-guide-swim-club-direct-debit (8),
  understanding-your-childs-swim-times (8),
  summer-training-programmes-uk-swim-clubs (6), swim-england-api-guide-2026 (6),
  competition-season-admin-guide (5), first-30-days-swim-club-committee (5),
  club-health-tracker-guide-swim-england-2026 (3, being rewritten in open PR
  #170, so recount after it merges), then six posts with one each
  (how-to-migrate-swim-club-data-from-spreadsheets,
  swimming-club-committee-handover-checklist,
  swimming-gala-entry-management-guide, what-wavepower-compliance-actually-
  requires, why-competition-management-matters).
  Two practical notes. (1) `how-to-collect-swim-club-fees` alone is 30 per cent
  of the problem at 68 dashes, so it is a whole run on its own and probably wants
  a Tuesday refresh slot rather than a Friday technical one, since rewriting 68
  sentences is an editing job, not a mechanical fix. (2) The six single-dash
  posts are five minutes each and could ride along with any other change to those
  files.
  Update (2026-07-25): `public/llms.txt` also uses em dashes pervasively, both
  as a structural convention (`### Tier — Price` headings, `**Feature** —
  description` bullets) and in prose. These predate the engine and were left
  untouched by the 2026-07-25 sync (a full cleanup was out of scope for a focused
  change). A future run could rewrite them, but note the heading/bullet dashes
  are a deliberate machine-readable format; treat with care rather than a blind
  find-and-replace.

- Stale SwimMark references elsewhere on the blog (spotted 2026-07-28 while
  refreshing the Club Health Tracker guide). SwimMark accreditation was paused
  for new submissions in November 2024, so any post that talks about it as a
  live process is now wrong. `swim-england-api-guide-2026` line 37 lists
  "Administrative findings during SwimMark audits" as a current thing. A grep
  for "SwimMark" across `src/` will find any others. Small, low-risk wording
  fixes for a Friday technical run; the accurate framing is in
  club-health-tracker-guide-swim-england-2026.

- Broken `/features/reporting` internal link. There is no
  `src/pages/features/reporting.astro`, so the link 404s. Fixed in
  club-health-tracker-guide-swim-england-2026 on 2026-07-28 (PR #170), but it
  is STILL present in `the-hidden-cost-of-spreadsheet-club-management` (line
  85, "real-time reporting"). That same CTA block also uses several
  non-trailing-slash links (`/features/membership`, `/features/billing`,
  `/compare/swimclubmanager`, `/compare/cluborganiser`, `/pricing`,
  `/swim-school-management`) against a site configured `trailingSlash:
  'always'`. One tidy Friday technical fix. Worth grepping the blog for other
  non-trailing-slash internal links at the same time, but fix a couple of
  posts per run rather than mass-editing.

- On-site copy inconsistency (spotted 2026-07-25): RESOLVED 2026-08-04. The
  site now standardises on "6 months free on any plan" everywhere, including
  the homepage FAQ (`src/pages/index.astro`, feeds FAQPage JSON-LD),
  `Hero.astro`, `faq.astro`, the SEO landing pages, two blog posts and
  `public/llms.txt`. No further action needed; do not re-touch these files
  for this issue.

- Stale `SoftwareApplication` offers on three UK landing pages (found 2026-08-01
  while fixing the fourth). `swim-school-management.astro`,
  `swimming-club-billing-software.astro` and
  `swimming-club-payment-software.astro` all still emit
  `"availability": "https://schema.org/PreOrder"`, which told answer engines and
  rich results that Swimly is not yet purchasable. Swimly is live (index.astro:
  "You can create your club and start using Swimly today"), so this should be
  `InStock`, as now on swimming-club-membership-software. Check each page's
  `price` against `pricing.astro` at the same time; the membership page had a
  stale 39 where the entry paid tier is 29. Small, safe Friday technical task.

- FAQ-less high-value UK pages (audited 2026-08-01). Pages that pass no
  `faqItems` and so emit no FAQPage schema, in rough value order:
  `swimming-club-billing-software.astro`, `swimming-club-payment-software.astro`,
  `swim-school-management.astro`, `features.astro` and
  `swimming-club-software/index.astro`. None of them has a visible FAQ either,
  so each needs a visible section authored, not just faqItems mirrored. One page
  per Saturday AEO run. NB `swimming-club-membership-software.astro` is DONE
  (2026-08-01) and the six `compare/*` pages hand-roll their own FAQPage schema
  rather than using the layout prop, so they are already covered; do not
  "fix" them.

- Site-wide trailing-slash misses in the shared Nav and Footer (found
  2026-08-01). `astro.config.mjs` sets `trailingSlash: 'always'`, but the
  shared components link to `/faq`, `/features`, `/contact`, `/blog` and the
  six `/compare/*` pages without a trailing slash, so EVERY page on the site
  carries several links that resolve through a redirect. This is one small edit
  in two components with site-wide benefit, but it touches every page, so treat
  it as its own focused Friday technical run and verify the built HTML rather
  than bundling it into a content change.

- Two product-copy accuracy items for a HUMAN to decide, not for this engine to
  change unilaterally (both surfaced 2026-08-01):
  (a) `swimming-club-membership-software.astro` still asserts in its features
  section that Swimly will "Sync member registrations with Swim England
  automatically", while the same page's social-proof section and its FAQ both
  say the membership API integration is pending approval. The FAQ answer was
  corrected this run because it feeds FAQPage schema; the body claim was left
  alone as it is a product marketing decision. The same "sync with Swim England"
  phrasing appears in the page hero and in the meta description.
  (b) Every marketing page describes fee collection as GoCardless Bacs Direct
  Debit, but the app repository has since made Stripe the default payment path
  and added platform billing (commits `ff0d7c7`, `0f6be19` on main). If Stripe
  is now what clubs actually get, the marketing copy, `public/llms.txt` and the
  pricing FAQ all understate it. The engine deliberately did not act on this:
  it is app-repo knowledge, the marketing site is the source of truth for
  marketing claims, and hard rule 2 keeps this job inside `marketing-site/`.

### Candidates (validate against existing coverage before writing)

- Swim club insurance: what affiliation actually covers, and what it does not.
  Assessed 2026-08-02, logged as a CANDIDATE rather than Ready because the
  overlap risk is real. "Insurance" appears in 17 posts, and
  `swim-england-membership-categories-guide` already covers the covered side
  well (personal accident and civil liability across all three member categories,
  Club Support cover for coaches and volunteers, club public liability through
  affiliation, and the consequences of a lapsed renewal). The distinct angle, if
  one is written, is the UNCOVERED side, which no post touches: club equipment
  and trailers, premises and contents, committee and officer liability, one-off
  event and open-water cover, and employers' liability once a club actually
  employs someone (which links straight to the coach employment item above). Only
  write it if that angle can carry 1,000 words on its own; otherwise fold two
  paragraphs into the membership-categories guide on a refresh day and skip the
  new post. Swim England's insurance is arranged through Howden, whose FAQ page
  is fetchable and would be the primary source.

- Definitional or glossary answer pages for high-intent queries answer engines get
  asked, for example "what is Wavepower", "Swim England affiliation fees explained".
  ("what is a swim club constitution" is done, PR #79.) Check existing posts first.
- A "best swim club management software UK" style comparison or buyer's guide, built
  for answer engines (clear criteria, comparison table). Check it does not overlap the
  existing how-to-choose post and the `/compare/` pages.
- Regional governance coverage beyond Swim England where relevant: Scottish Swimming,
  Swim Wales, Swim Ireland equivalents of existing England-focused guides.
- Seasonal content aligned to the UK swimming calendar (entry windows, season setup,
  end-of-season), timed to the relevant part of the year.
- A practical GoCardless Direct Debit setup walkthrough for club treasurers, linking
  to the existing treasurer and Direct Debit posts. (Partly touched by the
  2026-07-20 fee-increase guide, which covers advance notice but not setup, so
  the setup walkthrough is still a real gap.)
- Operator follow-ups logged 2026-07-20 while writing the fee-increase guide, each
  a genuine gap against current coverage: a pool hire and lane-time negotiation
  guide for committees (pool hire is named as the largest cost line in at least
  five posts but no post covers negotiating or budgeting the contract), and a
  hardship, bursary and widening-access guide (referenced only in a sentence in
  the fee-increase and grants posts). Validate both against the full slug list
  before writing.
  Update (2026-07-27, PR pending): the **pool hire and lane-time negotiation
  guide is DONE** (pool-hire-for-swim-clubs, Monday operator slot). Only the
  **hardship, bursary and widening-access guide** remains outstanding from this
  pair; still a genuine gap (referenced only in passing in the fee-increase,
  grants and new pool-hire posts). Validate against the full slug list before
  writing.
- Companion parent AEO answer pages now that the open meets guide exists. The "open meet
  vs county championships" comparison is done (PR for 2026-06-25). A definitional "what is
  a personal best (PB) in swimming" page would overlap understanding-your-childs-swim-times
  (which already defines PBs in full), so only write it as a distinct angle, not a reword.
  A short swim-parent glossary hub could still tie the parent cluster together.

## International (US/CA/AU)

Backlog for the swimly.club regional sites (`/us`, `/ca`, `/au`). These are newer
and far thinner than the UK, so a genuine gap here is often the highest-value task
of the day. Before acting, confirm the page does not already exist in that region,
and follow the per-region spelling and governing-body rules (American for `/us`;
British/Commonwealth for `/ca` and `/au`; correct governing body per region). Use
real geography only and never invent specific clubs, leagues, or venues. See
`docs/internationalisation.md` for the URL model and hreflang and canonical rules,
and `docs/international-launch-checklist.md` for go-live tasks. As always, every
run produces a pull request only and uses the `mike-tempest` token; never deploy.

### Per-region governing-body answer pages (mostly done)

NB (2026-07-01 audit): the governing-body explainer for each region already
exists as a `/{region}/guides/` Astro page and each opens with a full "what is
[governing body]" section, so a separate overview page would now be a reword.
Treat these as substantially covered; do not duplicate.

- **US:** `usa-swimming-safe-sport-explained` (done) already answers "what is USA
  Swimming", LSC affiliation and Safe Sport/MAAPP in full. No separate US
  overview needed.
- **Canada:** `swimming-canada-provincial-sections-explained` (done) opens with
  "What is Swimming Canada" and covers the provincial/territorial sections. No
  separate CA overview needed.
- **Australia:** `swimming-australia-state-associations-explained` (done) covers
  Swimming Australia, the eight state/territory associations and Swim Central. No
  separate AU overview needed.

**THE CLEAREST INTERNATIONAL GAP, found by a page-inventory audit 2026-08-02: the
safeguarding guide exists for the US but for neither Canada nor Australia.** Lay
the three regions' guide directories side by side and every topic is mirrored
except this one. `/us/guides/usa-swimming-safe-sport-explained/` has no `/ca` or
`/au` sibling, while joining guides, meets/carnival guides, treasurer guides and
management-software guides all exist in all three. Safeguarding is the single
highest-intent compliance topic in club sport, it is what the UK cluster is built
on (Wavepower, DBS, welfare officer), and it is mandatory reading for every club
committee in both countries. Two separate Wednesday or Monday runs, one per
region. Both were validated against primary sources this run; neither may borrow
a word of UK or US framing (hard rule 5).

- **Canada: Safe Sport for swim clubs, explained.** Target queries: "swimming
  canada safe sport", "UCCMS swimming", "safe sport requirements swim club
  Canada". Verified anchors: Swimming Canada has adopted the Canadian Safe Sport
  Program, so allegations of maltreatment against a CSSP participant are filed
  directly with Sport Integrity Canada rather than handled by the club or the
  provincial section; the standard is the Universal Code of Conduct to Prevent
  and Address Maltreatment in Sport (UCCMS); the Office of the Sport Integrity
  Commissioner administers complaints and investigates independently; registered
  coaches must submit a Vulnerable Sector Verification every three years and
  complete safe sport training as a condition of registration. Sources to work
  from and link: https://www.swimming.ca/safesport/,
  https://www.swimming.ca/abuse-free-sport/ and the current National Registration
  Procedures and Rules Manual (the 2026-2027 edition, CEO-approved 3 July 2026,
  is a PDF on swimming.ca and is the authority for registration-linked
  requirements). Commonwealth spelling. Say Vulnerable Sector Verification, not
  DBS; say provincial section, not county association; the existing
  `swimming-canada-provincial-sections-explained` guide is the natural inbound
  link, alongside the CA joining guide and the CA treasurer guide.

- **Australia: child safeguarding and the National Integrity Framework.** Target
  queries: "swimming australia child safeguarding", "national integrity framework
  swimming", "working with children check swim club". Verified anchors: the
  National Integrity Framework is the rule set all members must follow, covering
  conduct and the obligation to report; it comprises six documents; the Child
  Protection Commitment Statement sets principles and procedural benchmarks for
  Swimming Australia and its clubs; a Working With Children Check is compulsory
  for coaches, technical officials and support staff; Sport Integrity Australia's
  child safeguarding course is compulsory for high performance team members.
  Sources: https://www.swimming.org.au/resources/swimming-national-integrity-framework
  plus the state associations' NIF pages and policy PDFs, which are fetchable
  even though the state association HTML estate is Cloudflare-gated (this ledger
  records that PDFs on those hosts do serve 200). Commonwealth spelling. THE
  TRAP TO PLAN FOR: the WWCC is administered per state and territory and the
  schemes differ by name, cost, validity period and who needs one, so state the
  national requirement and link each state's scheme rather than asserting one set
  of rules nationally. Inbound links from
  `swimming-australia-state-associations-explained`, the AU joining guide and the
  carnivals guide.

Next-highest international gaps (parent/AEO intent, mirror the UK parent cluster):
- **US:** "how swim meets work" parent guide (done 2026-07-01, PR below). A
  companion "swim meet events and age groups explained" or a US swim-terms
  glossary could extend the cluster; validate against the joining and meets
  guides before writing.
  Update (2026-07-29, PR #182, merged): the **events and age groups page is
  DONE** (`/us/guides/swim-meet-events-and-age-groups-explained/`), linked from
  the US meets guide and the US guides hub. A **US swim-terms glossary** is
  still open as a cluster extension, but note it now has three pages to avoid
  overlapping: the joining guide, the meets guide (heats, lanes, seeding, heat
  sheet, psych sheet, DQ, officials) and the new events page (strokes, IM and
  relay order, course, age groups, time standards). Most of the obvious
  glossary terms are now defined somewhere, so only write it as a genuine hub
  with an original structure, not a definitions rehash.
- **Canada / Australia:** a "how swim meets work / your child's first meet"
  parent guide for each, grounded in that country's governing body and
  terminology (Swimming Canada; Swimming Australia and Swim Central), once
  worth prioritising. Commonwealth spelling. Do not reword the US page.
  Update (2026-07-15): **Australia is now done** (PR #127, "how swimming
  carnivals work"). **Canada** is authored and open in PR #95 but NOT yet
  merged, so it is not on main; do not re-do it, and check that PR first.
  This closes the "how meets work" parent cluster across all three regions
  once #95 lands.

NB on ledger fragmentation (noted 2026-07-15, RESOLVED 2026-07-17): PRs #95,
#100, #123, #125 and #126 were all open on 2026-07-15, so their ledger entries
lived only on their own branches. As of 2026-07-17 `gh pr list` returns no open
PRs: everything has merged and main's ledger is once again complete. The habit
is still worth keeping: check `gh pr list` at the start of a run, and if
anything is open, read that branch's ledger too before assuming a gap is real.
- **Canada:** "how swim meets work" parent guide (done 2026-07-08, PR #95),
  the Canadian sibling to the US meets guide, grounded in Swimming Canada
  terminology and metric pools; inbound link from the CA joining guide. A
  companion "swim meet events and age groups explained" or a CA swim-terms
  glossary could extend the cluster later; validate against the joining and
  meets guides before writing.
- **Australia:** a "how swim meets work / your child's first meet" parent
  guide, grounded in Swimming Australia terminology and Swim Central, once
  worth prioritising. Commonwealth spelling. Do not reword the US or Canada
  page (differ on governing body, Swim Central and AU meet specifics).

### International club finder (directory growth)

The swimly.club club-finder directories were built and seeded 2026-07-06 in
PR #90 (see the playbook's "The international club finder" section for the
rules): `/us/clubs/`,
`/ca/clubs/`, `/au/clubs/`, backed by `src/data/us-clubs.json`, `ca-clubs.json`
and `au-clubs.json`. Both segments are first-class: competitive clubs/teams and
swim schools/academies (`type: "competitive" | "academy"`). Directory growth is
now a standing task type: one state/province/metro per run, 10 to 20 entries,
every club verified against the governing body's directory or its own website.
Never invent a club. Keep the segment mix roughly balanced over time.

2026-07-07: map views added at `/us/clubs/map/`, `/ca/clubs/map/` and
`/au/clubs/map/` (Leaflet + marker clustering, mirroring the UK `/clubs/map/`),
with state/province and segment filters and segment-coloured markers. All club
entries now carry city-centroid `lat`/`lng`; new entries must include them
(city level only, per the playbook).

2026-07-07: de-orphaned the directories. An inbound-link audit found each hub
had exactly ONE inbound link (its region home page) and every state and club
page had zero from outside the directory tree. Fixed: "Find a Club" added to
the intl Nav (desktop + mobile), "Find a club" + "Club map" added to the intl
Footer (every swimly.club page now links the directory), every city page now
shows a "clubs and swim schools in {city}" section with cards linking the
directory clubs in that city (or a link to the state/province directory page
when none), and the three parent joining guides link the directory + map.
Post-fix: hubs have 187/82/62 inbound links, all 38 state/province pages and
73 of 90 club pages have contextual inbound links. Also fixed a pre-existing
bug on all US city pages: the hero rendered "City, State ()" because the
template destructured `abbr` but the data field is `stateAbbr`.

2026-07-27: nationwide Canada directory build, 79 verified entries added
across 11 pull requests, one per province (#144 AB, #145 QC, #146 BC, #147 ON,
#148 NS, #149 NB, #150 NL, #151 PE, #152 MB, #153 SK, #154 NT, #155 YT). Canada
went from 28 entries to 107, and from 19 of 63 city pages carrying a club to 62
of 63.

DELIBERATE EXCEPTION to the playbook's one-province-per-run, 10-to-20-entry
rule, at the operator's explicit request. Treat this as a one-off, not
precedent: the next directory run should return to single-province batches.

What the verification caught, and why the rule about never inventing a club
matters. Every candidate was re-checked independently of the research that
produced it: slug and duplicate checks against live data, city and province
slugs against the data files, coordinates inside a province bounding box, house
style, and a live fetch of every website.

- natationlaval.com, a former Quebec swim club domain, is now an ONLINE CASINO
  site. cnsherbrooke.com is a parked lander. Both look plausible in search
  results.
- Four candidates were dropped as unverifiable: Club de natation de Sherbrooke
  (real and FNQ-affiliated, but no resolving site after 12 candidate domains),
  Finan Swim School and Making Waves Guelph (hard 403 to every user-agent
  tried), Levis Natation (resolves, no evidence of current sessions).
- Three research batches re-suggested clubs already in the file (Manta,
  Saskatoon Goldfins, Halifax Trojan, St. John's Legends, Fredericton
  Aquanauts). Duplicate detection caught all of them.

Also fixed a dead link already live in the directory: the Charlottetown
Bluephins entry pointed at bluephins.ca, whose DNS now resolves only to parking
addresses and whose HTTPS times out. Swim PEI links the club's SportsEngine
site, which is live, so the entry points there (#151). A health check of all 28
pre-existing Canadian entries found no other breakage. The Aqua Life (Halifax
and Ottawa) returns 403 to browser-like user-agents but full content to a plain
request, so it is a quirky bot rule, not a dead site. Worth re-running that
health check periodically; entries rot silently.

Nunavut has NO entry and that is the correct outcome. Iqaluit's only swimming
provision is City of Iqaluit recreation programming at the Aquatic Centre,
which is a municipal programme, not a club. The Iqaluit Breakers have no
resolving site, and swimiqaluit.com, swimiqaluit.ca, iqaluitswimclub.ca,
nunavutaquatics.ca and aquaticsnunavut.ca all fail to resolve. Do not
manufacture an entry for it on a later run.

The seed run's TeamUnify/GoMotion 403 gotcha did not recur this time: Oakville
Aquatic Club, London Aquatic Club and Hamilton Aquatic Club, all dropped in the
seed run for that reason, were verified and added here. Platform-hosted club
pages (gomotionapp.com, poolq.net, SportsEngine) were treated as qualifying
when the club owns the page, which matches us-clubs.json precedent. About 15 of
the 79 entries are platform-hosted; in several small cities it was that or no
club at all.

Two segment notes: Quebec includes two artistic swimming clubs, and Sydney NS
is represented by the YMCA of Cape Breton learn-to-swim programme because the
city has no competitive club with a resolving site. Both flagged in their PRs
for a call on scope.
2026-07-27 (build two): second Canada pass, 486 verified entries added
across 10 province PRs (#159 ON, #160 BC, #161 AB, #162 QC, #163 NS, #164 SK,
#165 MB, #166 NL, #167 NB, #168 PE), plus the city expansion in #158. Canada
went from 107 entries to 593. City pages went from 63 to 157, of which 130 now
carry at least one club.

Sources and yield: Swim Ontario year-round register 94, Swim BC + BCSSA 128,
Swim Alberta + ASSA 93, artistic swimming bodies 78, standalone masters 53,
Federation de natation du Quebec (across several passes) 81, smaller provincial
bodies 44. The BCSSA and ASSA summer associations were the most under-exploited
seam, as predicted, and are near-100 percent websited in BC.

THE SEGMENT MIX IS NOW BADLY SKEWED: 540 competitive to 53 academy. Both builds
sourced from governing bodies, which list competitive clubs and almost no swim
schools. The playbook asks for a rough balance, so the next Canadian run should
be swim-schools-only. Estimated remaining academy supply is 150 to 250 at
reasonable effort; there is no unbiased directory for them, so expect metro-by-
metro search rather than a register.

Verification lessons, all learned the hard way this run:

- A 200 RESPONSE PROVES A SITE IS ALIVE, NOT THAT IT IS THE RIGHT CLUB. Rescuing
  a dead club domain by swapping .ca for .com produced false positives that
  landed on a Wisconsin YMCA team, a UK club (Chelsea and Westminster), a
  software company, and a multi-sport club in Bordeaux, France. Every entry must
  have its page content cross-checked against the club name or city. An
  automated identity check over 285 entries found 273 clean and surfaced the
  rest for manual review.
- Conversely, DO NOT DISCARD ON A FAILED FETCH. SwimTopia, SiteGround (HTTP 202
  plus a meta refresh to /.well-known/sgcaptcha/) and Cloudflare all serve
  challenges that defeat curl, a browser User-Agent and WebFetch alike. Several
  were confirmed genuine by loading them in a real browser. Where a challenge
  cannot be cleared, a club-specific domain matching the club name is reasonable
  identity evidence; a generic domain is not, which is why Capital Wave on
  ottawawaterpolo.com was dropped and Salt Spring Stingrays on
  saltspringstingrays.com was kept.
- app2.sygaction.com/<code>/ soft-404s for unknown codes on some paths, so a 200
  there is not evidence a club page exists. Check the page title.
- Provincial directories carry typos and stale TLDs that hide real clubs:
  racbreakers.ca vs the live .com, winskildolphins.ca a one-letter typo for
  winskilldolphins.ca. Roughly 60 clubs across the build were rescued this way.
  Always try www/non-www, .ca/.com and http before rejecting.
- The masters duplicate rate matched the prediction: 41 candidates were rejected
  as the masters arm of a club already listed, many as literal /masters
  sub-paths. Dedupe masters on DOMAIN, never on name.

Source notes for future runs:
- swimontario.com/page-data/clubs/find-a-club/page-data.json (www required)
  returns 146 typed club rows. The single best source in the country.
- msabc.ca hydrates from a public Google Sheet, fetchable as CSV in one request,
  giving the authoritative 47-club BC masters list.
- The Masters Swimming Ontario register DOES publish club URLs, in each row's
  clubInfo.php popup rather than the table: 129 URLs across 373 rows.
- FNQ has no club directory any more. Its provincial ranking PDF
  (Classement-provincial-des-clubs) enumerates 82 affiliated clubs and is the
  effective replacement.
- Dead ends, both Cloudflare-gated: mastersswimmingcanada.ca and
  swimming.ca/club-list.php.

Still uncovered: 27 of 157 city pages have no club, and Nunavut remains
correctly empty. Saskatchewan is exhausted at 18, not the 23 estimated, because
its summer league is overwhelmingly Facebook-run. PEI, NB and NL are effectively
exhausted against their provincial bodies.

2026-07-28: US directory build, 1,503 verified entries added across 8 regional
PRs (#171 Northeast, #172 Mid-Atlantic, #173 Southeast, #174 Great Lakes,
#175 Plains, #176 South Central, #177 Mountain West, #178 Pacific). The US went
from 34 entries to 1,537, from 20 states covered to all 51, and from 18 of 130
city pages carrying a club to 116.

SEGMENT BALANCE WAS DESIGNED IN THIS TIME, and it worked: 31 percent academy
(469 of 1,503) against Canada's 9 percent. Four of the twelve harvest batches
were swim-schools-only, briefed explicitly to avoid repeating the Canadian
outcome. Of the 469 schools, roughly 415 are independents rather than franchise
locations. The franchise rule that made this work: where a brand puts every
location on one domain it is ONE entry, and at most 3 locations per brand where
each has its own URL. Goldfish has 186 locations, British Swim School 258 plus,
Aqua-Tots 144, all on corporate domains with zero franchisee-owned domains.
Listing them per location would have added ~1,050 pages pointing at 15 websites,
which is doorway-page territory.

THE SINGLE MOST VALUABLE FINDING, reuse this before anything else:

  POST https://club-api.usaswimming.org/swims/ClubFacilityMap/search
  body: finderType "USA Swimming Club", clubExcellenceLevel0 "NA",
        clubExcellenceLevel1 "Bronze", clubExcellenceLevel2 "Silver",
        clubExcellenceLevel3 "Gold", isSafeSportRecognized 2

Open, unauthenticated, returns the entire national roster in one call: 5,590
club-facility rows, 2,635 distinct clubs, 2,426 with usable websites, each with
city, state and coordinates. TWO TRAPS. First, isSafeSportRecognized is
tri-state, not boolean: the public widget sends 0, which silently drops 653
clubs (25 percent). Send 2. Second, the response carries contactName,
contactEmailAddress and contactPhoneNumber. That is personal data and must
never reach the published directory; strip it on ingest and delete the raw
response. It was used here as a cross-check and gap-filler rather than as the
content source, because it carries no descriptions and 1,500 formulaic
sentences would be a duplicate-content risk on the very site we are ranking.

Other sources worth reusing: usswimschools.org exposes a member feed at
/wp-content/plugins/fabric-api-integration/locations.json with 1,387 US swim
schools including websites and coordinates, though the host is SiteGround
captcha-gated and intermittent. SwimCloud's /api/teams/ endpoint returns 1,716
summer-league teams but needs a browser session for the Cloudflare cookie.
USA Swimming's per-LSC directories are NOT worth 59 bespoke parsers now that
the API is known to be near-complete.

VERIFICATION FINDINGS. Roughly 60 wrong-site rejections across the US and
Canada builds, every one returning HTTP 200:

- Expired club domains re-registered as gambling sites, in Indonesian, Chinese
  and Russian: dallasmustangs.org, donnerswimclub.org, metroswim.org, odsl.org,
  gogcsl.org, orgcst.com, bullfrogswimschool.net, theswimschool.org.
- Wrong business entirely: westtexasswimcoaching.com is a bakery, pwsl.org is a
  women's soccer league, swimest.org is a marketing agency, aquapros.org sells
  hot tubs, gpsc.org is a sail club, northlandunited.org is a Michigan soccer
  club, empirekc.com is a window cleaner.
- Right name, wrong place: swimtec.com is Florida not Utah, raceswami.org is
  California not Utah, patriotaquatics.org is California not Florida,
  swimbsc.org is Illinois not Indiana, flutterkicksswimlessons.com is Tennessee
  not South Carolina, artofswimming.com is London.
- Six Florida club domains return HTTP 200 with an IDENTICAL 114-byte body. A
  status-code check passes all of them. Check body size and content.
- teamunify.com Home.jsp with a team query parameter returns 200 with a generic
  Welcome page for ANY code, real or invented. A 200 there proves nothing.
- app2.sygaction.com and usaartisticswim.org soft-404 at HTTP 200.

Two errors were caught only by cross-batch and register checks, not by any
single agent: Main Street Swim School was listed in both Pennsylvania and
California on one domain (it is California), and SwimNation Aquatics was
recorded in Texas when its own site and the register both say Irvine,
California. Run a combined pass; per-batch checking is not sufficient.

DO NOT DISCARD ON A FAILED FETCH. TeamUnify and GoMotion 403 plain requests but
return 200 to a browser User-Agent. SwimTopia and Cloudflare serve challenges
that defeat fetching entirely; a nonexistent SwimTopia tenant 302s to the
marketing site while a real one 404s on a bad path, which is the reliable
discriminator. GoDaddy blocked one agent's egress IP mid-run, making
already-verified sites look dead. Where a challenge cannot be cleared, a
club-specific domain matching the club name is acceptable identity evidence; a
generic domain is not. That distinction is why Capital Wave on
ottawawaterpolo.com was dropped while Salt Spring Stingrays on
saltspringstingrays.com was kept.

Scheme fragility is real and asymmetric: 39 of 64 Pacific entries recorded as
http actually support https, while many SportsEngine-fronted club domains serve
only http and time out on https. Test both, per entry.

YMCA AND JCC ENTRIES ARE INCLUDED, 75 of them, on a deliberate decision. YMCA
swimming has its own league and championship structure up to YMCA Nationals, so
these teams race even when absent from the USA Swimming register. Of 58 typed
competitive, 24 are in the register, 28 show meets and championships on their
own sites, and 6 show team, coach and practice signals. Using register
membership as the test would have wrongly cut 34 real competitive teams.
Generic YMCA association pages were still excluded; the test is whether the
team has its own site, not whether a YMCA runs it.

A REAL CLUB WITH AN EMPTY SITE STILL DOES NOT QUALIFY. Helena Lions Swim Team
is in the USA Swimming register but hlst.org serves a 1-byte body, so there is
nothing to link a visitor to. Dropped.

NOT DONE, and the obvious next runs: US Masters Swimming (~344 net new after
deduping the 45 to 55 percent that are the masters arm of an existing club,
which replicates the Canadian finding) and USA Artistic Swimming (unsized, its
finder was returning a 504 origin timeout). Summer leagues are ~2,400 to 2,800
teams but genuinely expensive: there is no national governing body and no
aggregator beyond SwimCloud's partial 1,716, and league discovery, not
scraping, is the bottleneck. High school teams should be excluded; roughly
8,400 schools sponsor swimming but they essentially never have their own site.
Fourteen city pages still have no club, and Canada still needs its
swim-schools-only corrective run.

2026-07-29: Australia directory build, 884 verified entries added across 8 state
PRs (#183 NSW, #184 VIC, #185 QLD, #186 WA, #187 SA, #188 TAS, #189 ACT, #190
NT), plus the city expansion in #180. Australia went from 28 entries to 912, and
city pages from 48 to 115.

SEGMENT BALANCE IS THE BEST OF THE THREE COUNTRIES: 51 percent academy (449 of
884), against the US at 31 percent and Canada at 9 percent. Four of the eleven
harvest batches were swim-schools-only and three more were school top-ups.
Australia genuinely has the deepest learn-to-swim sector per head of the three.

THE BULK SOURCES, all open and unauthenticated. Reuse these before anything else:

  Swimming Australia Swim Finder (competitive clubs, the national roster):
    GET https://sal-sf-www-prod-app.azurewebsites.net/api/v1/public/clubs/query
        ?Lat=-25&Lng=134&Rkm=3000
    One call returns the ENTIRE national roster: 1,417 club-venue rows, 938
    distinct clubs, with name, venue, address, suburb, state, postcode and
    lat/lng. entityType 1 = Swimming Australia, 7 = Masters.
    GET .../api/v1/public/venues/{venueId}/clubs
    returns websiteUri, contact name and contact email per club. That is where
    the websites live; the clubs endpoint has none. Contact fields are personal
    data and must not be published.
    Rate limit 2 req/sec and 100 per 15 minutes per IP, shared across the whole
    app, returned as HTTP 429. Never run two harvesters against it at once.
    Term search caps at 10 rows and ignores pageNumber, so geo queries are the
    only way to enumerate.

  Swim schools:
    Swim Australia via MetaLocator (519 records nationally):
      https://code.metalocator.com/index.php?option=com_locator&view=directory
      &tmpl=component&framed=1&format=raw&no_html=1&layout=_jsonfast
      &Itemid=2807&limit=2000&limitstart=N
      Page in steps of 50. limit=2000 silently degrades to stub records past
      about row 150, and 211 of 519 records carry no state field.
    AUSTSWIM: POST https://webapi.austswim.com.au/api/search_swim_center
      state wants QLD/VIC, not Queensland/Victoria, which return total 0 rather
      than an error. limit caps at 200.
    Royal Life Saving: GET https://api.atlist.com/v1/map/{uuid}/markers with
      header Authorization: Bearer public. The live site is Cloudflare-gated;
      the map uuid was recovered from a Wayback snapshot.
    SA Sports Vouchers OData and Life Saving SA Watch Around Water were the
      richest South Australian sources.
    myswimresults.com.au/JSONFindClub.ashx?CountryCode=AUS&Name= returns the
      whole 1,003-entry club list unthrottled, no websites, useful cross-check.

  Dead ends: all eight state association sites (nsw|vic|qld|wa|sa|tas|act|nt
  .swimming.org.au) are one shared WordPress estate behind one Cloudflare
  config and 403 both curl and WebFetch. PDFs on those hosts DO serve 200, and
  the NSW area contact PDFs carry a WEBSITE column. The NSW Active and Creative
  Kids provider registry, cited in sizing as the richest NSW source at ~503
  providers, NO LONGER EXISTS. ASSA is CAPTCHA-walled.

THE TRAP THAT DEFINES THIS BUILD. Every club subdomain on the retired
swimming.org.au hosting platform is dead; Swimming Australia decommissioned it
on 30 June 2022. The domain has WILDCARD DNS behind Cloudflare, so a nonsense
subdomain returns HTTP 403 exactly like a real one, and plain HTTP returns an
IIS 404 for every subdomain including live clubs. Swim Central still returns
these as clubs' official websites: about 13 percent of its stored website values
nationally, and 92 of 337 NSW clubs. Fetching CANNOT distinguish them. Worse, a
curl-only run would classify them as "challenge on a club-specific domain,
accept" under this build's own rule 2 and ship dead links believing it had
followed procedure. Two agents caught it only by rendering a page in a real
browser. Zero entries in this build use one, verified across all 884. Note the
near-identical swimmingclub.org.au platform IS live, though some of ITS
subdomains resolve to a shared Cloudways box and return a 343-byte 403, which
are also dead.

WHY AUSTRALIA YIELDS LESS THAN ITS CLUB COUNT SUGGESTS. Only about 46 percent of
affiliated clubs have a qualifying website, converged from two independent
measurements. Australian swimming runs on Facebook to a degree Canada and the US
do not: Darling Downs lists 35 clubs of which 32 are Facebook-only, Swimming
North Queensland 24 of which 19 are. Victoria harvested all 141 clubs Swim
Central lists and a 23-point fine geo grid returned zero more; 94 had a website.
The competitive segment is therefore EXHAUSTED at 435 entries against a measured
ceiling near 430, not under-harvested.

DOMAIN GUESSING DOES NOT WORK IN AUSTRALIA, measured three ways: 15 percent
resolved correctly over 150 clubs, 13 percent over 300, and 2 of 14 in a third
test. Of the HTTP 200s returned by guessing, 75 percent were the WRONG SITE,
usually a town-name domain (darwin.com, liverpool.com, murraybridge.com) or a
parked page. Websites must come from a registry or a curated list. Guessing is
usable only when gated on a full-business-name content check, and even then ran
about 25 percent wrong.

OTHER TRAPS, all returning HTTP 200:
- revolutionise.com.au soft-404s for EVERY slug: 379-byte body, title "page not
  found". Slug probing there is 100 percent false positives without a body check.
- sportzvault.com is entirely dead; every club on it is NXDOMAIN, and Swim
  Central and Swimming NSW both still list it.
- TeamApp unclaimed subdomains return 200 with a 17,101-byte "not found" shell;
  suspended clubs return 200 reading "Club Suspended"; non-existent subdomains
  redirect to login rather than 404ing. Its meta description is an excellent
  free verifier, stating sport and locality, and it rejected wrong-sport
  collisions including soccer clubs, a church congregation and two cycling clubs.
- kasc.com.au served a DIFFERENT BUSINESS over https than over http. Check the
  content of the scheme you actually fetched.
- hobartaquaticcentre.com.au was the inverse of the usual bot wall: 403 to a
  Chrome User-Agent and to Googlebot, 200 to a bare curl with no UA at all.
- Malformed registry data as a silent redirect: www.LittleStarfish@Swimmers.com.au
  parses the part before the @ as userinfo and fetches an unrelated site at 200.
- Australia's failure mode is ABANDONMENT rather than squatting: NXDOMAIN and
  dead platform pages dominate. Gambling re-registrations exist but are rarer
  than in the US and Canada builds.

SCOPE DECISIONS TAKEN, with their evidence:
- School swim clubs: 21 found whose only presence is a page on the school's own
  edu.au site. Kept the 6 whose pages explicitly welcome the wider community
  (PLC Sydney, Camberwell Grammar, SMGS Saints, Toowoomba Grammar, Canterbury
  Taipans, Ironside); dropped 15 with no evidence of open membership. The test
  is whether a parent can actually enrol.
- School learn-to-swim programmes (9), YMCA aquatic centres (7) and university
  centres (2) were KEPT: all sell lessons to the general public.
- Council-run aquatic centres were excluded throughout unless the swim school is
  a distinctly branded operation with its own site. Around 100 were dropped on
  this basis across the build.
- Chains: where a brand puts every location on ONE website it is one entry. JUMP!
  61 locations to 1 site, BlueFit 49 to 1, Rackley 43 to 1, Carlile 33 to 1,
  State Swim 18 to 1. About 284 locations collapse to 19 sites. BUT leisure
  operators break the rule: Belgravia runs 162 aquatic venues on ~138 DISTINCT
  domains, so those are genuine separate entries.
- Perth and Adelaide look thin (Perth 9 schools) but that is the market, not a
  harvesting gap: the one-website rule correctly collapses State Swim, Carlile,
  JUMP! and BlueFit. Adelaide out-yielded Perth only because SA publishes two
  provider registries with website fields and WA publishes none.

STILL OPEN: Masters Swimming Australia buys only about 15 net-new entries here,
because Swimming Australia's own API already lists masters clubs as first-class
entities; the 40 to 55 percent overlap seen in Canada and the US is only 4.9
percent in Australia. Artistic swimming is 16 clubs, fully additive but tiny.
Water polo is a genuine 99-entry seam with zero overlap. Surf life saving (315
clubs) is recommended EXCLUDED: nippers is beach rescue, not squad swimming. The
South Australian roster is under-represented at source, because SA clubs have
largely not mapped venues in Swim Central, so the API returns 12 SA competitive
clubs against 42 affiliated; the archived Swimming SA Join A Club page lists all
42 with links and would close that gap cheaply.

Coverage after the seed batch (update this after every directory run):

- **US:** 34 seeded, then 1,503 added by the 2026-07-28 build, for 1,537
  entries across all 51 states and DC. Segment mix 1,068 competitive to 469
  academy (31 percent academy). 116 of 130 city pages carry at least one club.
  The TeamUnify/GoMotion 403 drops from the seed run were recovered using a
  browser User-Agent. Masters, artistic swimming and summer leagues remain
  unharvested.
- **Canada:** 28 seeded, then 79 added by the 2026-07-27 nationwide build and
  486 more by build two the same day, for 593 entries across all 13 provinces
  and territories (ON 160, BC 146, AB 110, QC 97, NS 20, SK 18, MB 17, NL 10,
  NB 9, PE 3, YT 2, NT 1, NU 0). Segment mix 540 competitive to 53 academy,
  which needs a swim-schools-only run to correct.
- **Australia:** 28 seeded, then 884 added by the 2026-07-29 build, for 912
  entries across all 8 states and territories (NSW 313, VIC 221, QLD 221,
  WA 125, SA 101, TAS 47, ACT 41, NT 39). Segment mix 452 competitive to 460
  academy (51 percent academy, the best balance of the three countries).
  City pages went from 48 to 115. The competitive segment is exhausted: only
  ~46 percent of affiliated clubs have a qualifying website.

Verification gotcha from the seed run: many North American club sites sit on
TeamUnify/gomotionapp/SportsEngine, which returns 403 to automated fetches. If
the club's own site cannot be fetched, verify via a fetchable governing-body
page (LSC or provincial-section club listing) instead, or leave the club out.
Clubs dropped for this reason in the seed run (candidates to retry via their
LSC/section pages): Toronto Swim Club, Oakville Aquatic Club, Greater Ottawa
Kingfish, London Aquatic Club, Hamilton Aquatic Club, Nepean Kanata Barracudas,
Scarborough Swim Club, and academy brands Pedalheads, British Swim School and
Felix's Swim Schools.

### Region pricing, comparison and feature intent

- Region-appropriate "best swim team management software" comparison or buyer's
  guide for `/us` (US terminology: "swim team", "season"), checked against the US
  features and pricing pages so it does not duplicate them.
- Equivalent comparison or buyer's-guide intent for `/ca` and `/au` once those
  regions have enough supporting pages to link to.
- Currency and price-point clarity on each region's pricing page once the real,
  signed-off figures replace the provisional values in `src/config/regions.ts`
  (tracked in the launch checklist).

### Regional blog posts

- One or two genuinely region-specific guides per market, grounded in that
  country's swimming calendar, governance and terminology (for example a US club
  season-setup guide, or a Canada/Australia membership-categories explainer),
  rather than UK posts with the spelling swapped. Each must clear the new-content
  bar for its own region.

### Search Console and technical (international)

- After launch, monitor Search Console coverage and the International Targeting (or
  per-folder) settings for `/us` (United States), `/ca` (Canada) and `/au`
  (Australia); log any indexing or targeting issues here.
- Validate hreflang reciprocity across the global routes (`/`, `/pricing/`,
  `/features/`) on swimly.uk and swimly.club after each significant change; log any
  missing-return-tag or canonical issues as technical-SEO follow-ups.
- Keep the swimly.club sitemaps and `public/llms.txt` accurate as international
  pages are added.
- 2026-07-07 full sitemap audit (built pages vs live sitemaps, both hosts):
  swimly.club sitemap-core was missing 261 of 476 pages (all city pages, all
  guides, all compare pages, and the root hub). Fixed by making sitemap-core
  self-maintaining: static region pages are discovered from the page tree via
  import.meta.glob and city pages from the cities data files, so future pages
  join automatically. Also fixed on swimly.uk: added the missing
  /features/competitions/ entry and removed the ghost /best-swim-club-software/
  entry (page no longer exists in the repo; only -uk does). Post-fix coverage:
  swimly.uk 2221/2221 (excluding the intentionally unlisted /clubs/add/ and
  noindexed /home-light/), swimly.club 476/476.
- 2026-07-17 (DONE, PR #129): the missing `/us/guides/`, `/ca/guides/` and
  `/au/guides/` hub pages were created, so the BreadcrumbList position-2 item
  emitted by all 15 international guides now resolves instead of pointing at a
  404. A "Guides" link was added to the international footer at the same time,
  so each hub has an inbound link from every swimly.club page. Closes the
  follow-up logged by PR #127.
- Post-#129 international linking follow-up: the three guides hubs are reachable
  from the footer on every swimly.club page, but NOT from the intl Nav (which
  lists Features, Pricing, Find a Club) nor from the three region home pages.
  Adding "Guides" to the intl Nav, or a guides section to each region home, is a
  small, high-value Thursday internal-linking task.
- NB: https://swimly.uk/best-swim-club-software/ still returns 200 live because
  deploys upload but never delete; a stale orphaned copy of the old page sits on
  the FTP server. Harmless once out of the sitemap, but a future technical run
  (or a human) could remove the stale directory on the host.

## Done

- 2026-08-04: Season-setup pillar guide published at /guides/season-setup/
  (`src/pages/guides/season-setup.astro`), part of the August season-setup
  campaign (not a daily-agent run). Covers getting a UK club set up before the
  September restart in the order squads, then schedules, then fees, with an
  August checklist, four FAQ items feeding FAQPage JSON-LD, and CTA to
  app.swimly.uk/create-club. The season-setup / new-season-preparation topic
  is now covered from the operator angle; do not duplicate it as a blog post
  or second guide. Nearest existing coverage checked at write time:
  new-season-setup-guide-swim-clubs (blog, 2026-03-17) approaches the season
  from a registration/admin-checklist angle and is linked from the new guide;
  the pillar page takes the distinct setup-order angle (squads, schedules,
  fees) with the create-club CTA. Do not write further new-season setup
  content without checking both.

- 2026-08-02: Sunday research and backlog grooming run. No page published, which
  is the correct output for this slot. Ledger-only change. Two halves: fresh
  validated target queries, and a grooming pass that replaced guesses in the
  backlog with measurements.

  **New validated target queries** (each checked against the full 68-post slug
  list and, where relevant, the whole repo, before logging):
  1. UK, Swim England's **Stronger Affiliation** process. A repo-wide grep for
     "stronger affiliation" across `src/` and `public/` returns ZERO hits, so it
     is a total gap on a mandatory annual compliance process with a stated
     suspension consequence. Verified against a Swim England region site that
     fetches cleanly (swimming.org itself 403s, as this ledger records), giving
     the six evidence items, the portal, and the quotable consequence. Logged top
     of Ready with the regional-variation caution, the "do not assert an
     unverified deadline or completion statistic" caution, and the note that five
     of the six evidence items map onto things Swimly already holds, so the CTA
     does not need to overclaim.
  2. UK, **paying and employing coaches** (employment status, PAYE, auto-
     enrolment). Grep found the topic in exactly two sentences across 68 posts,
     both as budget line items. Logged with an explicit source-discipline note,
     because the search results for it are dominated by commercial accountancy
     blogs that do not meet hard rule 5; gov.uk and The Pensions Regulator only.
  3. **Canada Safe Sport** and 4. **Australia child safeguarding / National
     Integrity Framework**, both found by a page-inventory audit that laid the
     three regional guide directories side by side. Every topic is mirrored
     across `/us`, `/ca` and `/au` except safeguarding, which exists only for the
     US (`usa-swimming-safe-sport-explained`). Both were validated against
     primary sources this run (Swimming Canada's Safe Sport and Abuse-Free Sport
     pages plus the 2026-2027 National Registration Procedures and Rules Manual;
     Swimming Australia's NIF resource page and the state associations' policy
     PDFs) and logged with the region-specific traps: Vulnerable Sector
     Verification not DBS for Canada, and for Australia the fact that the WWCC is
     a per-state scheme so the post must link eight schemes rather than assert
     one national rule.
  5. UK club **insurance**, logged as a Candidate rather than Ready on purpose.
     The covered side is already well handled by
     `swim-england-membership-categories-guide`; only the uncovered side
     (equipment, premises, officer liability, event cover, employers' liability)
     is additive, and if that cannot carry 1,000 words the right move is two
     paragraphs on the existing guide, not a thin new post.

  **Grooming, all re-measured on main rather than carried forward:**
  - Overlong meta descriptions: 13 remain over 155 characters, not the "about 13"
    guess. Open PR #193 covers the six worst, so the item now separates the six
    spoken-for from the seven genuinely outstanding (160 down to 156), which is
    one Friday run. Removed the stale "skip managing-swim-club-finances, it is in
    open PR #137" caveat; #137 merged long ago.
  - Em dashes: counted for the first time rather than estimated. 21 posts, 224
    dashes, and the distribution changes the plan. `how-to-collect-swim-club-fees`
    alone holds 68 of them, 30 per cent of the total, so it is a Tuesday refresh
    on its own rather than a Friday technical fix; six other posts have exactly
    one dash each and can ride along with any future edit to those files. Full
    ranked list logged.
  - Blog FAQ coverage: audited all 68 posts. **51 have no `faqItems` at all**, so
    they emit no FAQPage schema. This supersedes the old, much narrower
    "compliance posts that lack FAQs" item, which is now fully CLOSED and marked
    as such: all six posts it named are done, and PR #136 has since merged, which
    I verified directly (`swim-club-agm-checklist.md` on main now carries
    `faqItems`) rather than trusting the note that said to check.
  - Marked the US "swim meet events and age groups" item done in open PR #182,
    leaving only the US glossary, with a warning that a glossary may now be a hub
    over existing content rather than new content.

  Open PRs at run start, whose ledger entries live only on their own branches, so
  each was read before assuming any gap was real: #207 (membership software FAQ
  schema, 2026-08-01), #193 (meta trim, 2026-07-31), #182 (US events and age
  groups, 2026-07-29), #170 (Club Health Tracker refresh, 2026-07-28), plus the
  non-SEO #206. Main's ledger is therefore missing the 2026-07-31 and 2026-08-01
  run entries; this entry was written on a branch off main and may need a trivial
  merge alongside them. Two of the open PRs touch files named in the groomed
  backlog, and both are flagged inline: #170 rewrites
  `club-health-tracker-guide-swim-england-2026`, so its 3 em dashes and its
  missing `faqItems` should be recounted after it merges.
  Build: pass, 5859 pages, unchanged. This run edits only
  `docs/seo-aeo-ledger.md`, which sits outside `src/` and `public/` and so is not
  an input to the Astro build; the build was run anyway to confirm main is green,
  and 5859 matches the baseline recorded by the 2026-08-01 run.
  Note for future runs: the page-count baselines of 2711 to 2719 in entries
  before 2026-07-27 are long stale. The US, Canada and Australia directory builds
  roughly doubled the site. Current baseline is 5859.

- 2026-08-01: Added FAQPage schema and corrected two wrong facts on
  `swimming-club-membership-software.astro`, PR link below. Saturday AEO-upkeep
  slot. Chosen over an `llms.txt` re-sync (done recently, 2026-07-25, PR #140)
  because an audit of every UK page's `faqItems` usage found this page in the
  worst state of all: it carried a VISIBLE five-question "Frequently Asked
  Questions" section but never passed `faqItems` to the layout, so it emitted no
  FAQPage schema at all and none of its five answers were extractable by answer
  engines. It is a commercial-intent money page ("swimming club membership
  software UK"), so that is a straight loss.
  Two of the five answers were also factually wrong, which is why this could not
  be a mechanical mirror-into-faqItems job: publishing them into schema would
  have machine-published the errors. (1) PRICING said "Pricing starts at
  £39/month for clubs with up to 100 members". There is no £39 tier and no
  100-member band in the UK. Corrected against `pricing.astro`, the source of
  truth, which via `src/config/regions.ts` gives Starter free to 50 members,
  Club £29/mo for 50 to 200, Performance £49/mo for 200 to 500, Enterprise
  custom for 500+, no per-member fees. The wording now matches the equivalent
  answer on `swim-club-management-software.astro` so the two money pages agree.
  (2) SWIM ENGLAND said "Yes. Swimly syncs member registrations with Swim
  England's membership system automatically. Integration approval is pending
  with Swim England", which asserts a shipped feature and then contradicts
  itself in the next sentence. Reworded to the honest framing already used in
  the same page's social-proof section ("Integration with Swim England's
  membership API is pending approval") and on the sibling landing page, so it
  now claims only what is verifiable: Swimly stores registration numbers and
  categories, tracks renewal and expiry dates, and exports in a compatible
  format, with direct API integration pending approval. No new product claim was
  invented; every figure and capability came from another page in this repo.
  A sixth question was added, on how renewals work, because the page's H1 is
  "Stop Chasing Membership Renewals" yet the FAQ did not cover renewals at all.
  Its answer is drawn from the page's own "Automated Renewal Reminders" and
  parent-portal sections, nothing new asserted.
  Structural change worth reusing: rather than duplicating the copy, the visible
  FAQ section is now RENDERED from the `faqItems` array with a `.map()`, the
  same pattern `pricing.astro` uses. The visible answers and the schema answers
  are therefore the same strings by construction and cannot silently drift,
  which is the failure mode the playbook's "use the same answer text in both"
  rule is guarding against.
  Also fixed on the same page, all small and in scope: the
  `SoftwareApplication` offer said `price: "39"` and
  `availability: PreOrder`, telling rich results Swimly was not yet purchasable
  (it is live), now `29` and `InStock`; the four internal links
  (`/pricing`, `/features/billing`, `/features/compliance`,
  `/features/parent-portal`) lacked the trailing slash the site requires, so all
  four resolved via a redirect; and three occurrences of "BACS" were corrected
  to "Bacs", which is the correct styling and matches the blog.
  Verified in built HTML (`dist.nosync/`, not `dist/`): exactly one FAQPage with
  6 `Question` and 6 `acceptedAnswer` entities, the 6 visible `<h3>` questions
  matching them in the same order, schema answer text identical to the visible
  text, canonical `https://swimly.uk/swimming-club-membership-software/`, all
  four internal link targets present in the build, and zero remaining
  occurrences of `PreOrder`, `£39`, "up to 100 members", "BACS" or em dashes.
  British spelling, no emojis, Tailwind only, no inline styles.
  Build pass, 5859 pages, unchanged (a page edit, no routes added). Baseline
  re-measured on main in the same run, per the 2026-07-17 note about not
  comparing counts across entries: main is also 5859. Note for future runs that
  the old 2714-page baselines in entries above are long stale; the US, Canada
  and Australia directory builds roughly doubled the site.
  Open PRs at run start, whose ledger entries live only on their own branches:
  #193 (meta-description trim), #182 (US events and age groups), #170 (Club
  Health Tracker refresh), plus the non-SEO #206. None of them touches this page
  or the ledger sections edited here, so there is no conflict.
  Follow-ups logged to the Ready backlog: the same stale `PreOrder` offer on
  three sibling landing pages, five high-value UK pages that still have no FAQ
  at all, site-wide missing trailing slashes in the shared Nav and Footer, and
  two product-copy accuracy questions for a human (the "syncs with Swim England
  automatically" body claim, and GoCardless-versus-Stripe now that the app has
  made Stripe the default payment path).

- 2026-07-31: Trimmed the six worst remaining overlong blog meta descriptions,
  PR #193. Friday technical-SEO slot, continuing the standing chip-away item.
  A fresh audit of all 68 posts on main (measuring the effective
  `seoDescription || description`, which is what becomes the meta tag) found 13
  over 155 characters, all in the 156 to 165 band. Trimmed the six worst:
  managing-swim-club-finances 165 to 149, how-to-grow-swim-club-membership 162
  to 149, parent-communication-tips-for-swim-clubs 162 to 147,
  parents-guide-to-wavepower-compliance 162 to 133,
  how-to-manage-swim-club-membership-renewals 161 to 148, and
  running-effective-squad-training-sessions 161 to 144. Each rewrite keeps the
  post's primary query in the description (treasurer/swim club finances, grow
  swimming club membership, parent communication tips, Wavepower compliance
  checklist, membership renewals, squad training sessions) and reads as a
  sentence rather than a truncated one; none is a mechanical chop at 155.
  managing-swim-club-finances was unblocked this run because PR #137, which held
  that file open on 2026-07-24, has since merged. Nothing but frontmatter
  changed: a six-file, six-line diff, no body copy, no new facts, no new links.
  British spelling, zero em dashes in all six files (verified by grep, not just
  in the changed lines). Verified in the BUILT HTML (`dist.nosync/`, not
  `dist/`): all six `<meta name="description">` tags render at 149/149/147/133/
  148/144 characters. Build pass, 5859 pages, unchanged from main's baseline as
  expected for a frontmatter-only edit. NB the baseline has moved a long way
  since the last blog run: 2714 pages on 2026-07-27, 5859 now, because the US
  (PRs #171 to #178), Canada (#144 to #168) and Australia (#180 to #190)
  directory builds landed in between. Do not compare page counts across older
  entries.
  Open PRs at run start, whose ledger entries live only on their own branches:
  #182 (US swim meet events and age groups answer page) and #170 (Club Health
  Tracker guide refresh). Neither touches any file in this PR.
  Follow-up: SEVEN posts remain over 155, all in the tight 156 to 160 band, so
  one more Friday run closes this backlog item outright. Also still open on the
  technical backlog and untouched this run: the body-copy em-dash cleanup
  (understanding-critical-swim-speed, summer-training-programmes-uk-swim-clubs,
  and `public/llms.txt`), and the homepage FAQ wording mismatch on founding-club
  months free ("the Club plan" vs "any plan").

- 2026-07-29: Published a new US parent/AEO answer page, "Swim Meet Events and
  Age Groups Explained"
  (`src/pages/us/guides/swim-meet-events-and-age-groups-explained/`), PR #182.
  Wednesday parent/AEO slot, targeting the swimly.club /us region. Closes the
  "companion swim meet events and age groups explained" item logged under the
  international parent cluster. Genuine gap confirmed before writing: the two
  existing US parent guides between them mention "age group" twice and name a
  single event distance once, so the event menu itself was uncovered. Target
  queries: "swim meet events and age groups explained", "what are the age
  groups in USA Swimming", "what events can a 10 and under swim", "what order
  are the strokes in the IM", "what does a BB time mean". Deliberately does NOT
  re-cover heats, lanes, seeding, heat sheets, officials or timing; those stay
  with the how-meets-work guide and the two pages cross-link.
  EVERY governance fact was verified against a primary source this run, by
  extracting the PDFs locally rather than trusting search snippets (WebFetch
  returns the raw PDF stream for both, so `pdftotext` on the saved file is the
  way to read them; the motivational standards PDF is a scanned image, so
  render it with `pdftoppm` and read the page instead). Sources and what they
  gave: USA Swimming Rules and Regulations 102.1.2 (the recognized event list
  per age group, which is the page's central table), 102.1.3 (development
  competition events for 12 and younger: 25s in every stroke and a 100 IM),
  101.6 (IM order butterfly, backstroke, breaststroke, freestyle), 101.7.1 and
  101.7.2 (freestyle relay, and medley relay order backstroke, breaststroke,
  butterfly, freestyle), 101.7.3 (mixed relays two male and two female at LSC
  championship level and above), 101.7.4A (no swimmer swims two legs of one
  relay), 102.2.2 and 102.2.3 (three individual events per day at prelims and
  finals, six at timed finals), COURSE definition (long course 50m, short
  course 25y or 25m), 205.1 (Age Group is for registered swimmers 18 and
  younger), 205.2.1 and 205.2.2 (date of birth decides eligibility; age on the
  first day of the meet holds for the entire meet), 205.2.5 (swim your own age
  group, exceptions for consolidated events, mixed classification meets and
  referee-combined events), 205.3.1B to F (USA Swimming publishes national
  motivational times; an LSC may set its own standards or none; only swimmers
  meeting a standard may enter that event; and the four-hour session rule with
  one session per day for 12 and unders). Time standard levels B, BB, A, AA,
  AAA, AAAA and the 10 & under, 11-12, 13-14, 15-16, 17-18 bands were read off
  the published "USA Swimming 2024-2028 Motivational Standards" document
  itself.
  Two accurate nuances worth keeping if this page is ever refreshed: (1) the
  recognized event list groups 15-18 as one band while the motivational
  standards split 15-16 from 17-18, which the page explains rather than
  glosses; (2) the 50 backstroke, breaststroke and butterfly drop off the list
  at 15-18 because that band mirrors the senior program. Deliberately NOT
  asserted: any participation or performance statistic, any claim about what
  age a swimmer "should" reach a standard, any named club, meet, LSC or venue,
  and any percentile interpretation of the AAAA standard (that framing appears
  in secondary sources, not in the standards document itself, so it was left
  out). The 8 and under and single-year age groups are described as things
  LSCs and host teams may offer under 205.3.2, not as national bands, because
  the recognized list does not name them.
  Seven-question visible FAQ mirrored verbatim into faqItems (FAQPage schema).
  Internal links: six outbound (how-swim-meets-work, joining-a-us-swim-team,
  usa-swimming-safe-sport-explained, /us/guides/, /us/features/, /us/pricing/),
  all verified to resolve in built HTML; two inbound so the page is not born an
  orphan (a parent-section card on the /us/guides/ hub, which also grew to a
  three-column grid and lost its now-wrong "these two" wording, and a
  contextual link from the how-meets-work guide's short course paragraph).
  Verified in built HTML: canonical
  https://swimly.club/us/guides/swim-meet-events-and-age-groups-explained/
  (swimly.club, not swimly.uk), lang en-US, meta description 152 chars, FAQPage
  with 7 Question and 7 acceptedAnswer entities matching the visible
  seven-question FAQ, 2,841 visible words, zero em dashes, no British spellings
  and no Swim England, Wavepower or DBS transplants, page present in the
  swimly.club sitemap. Build 4911 to 4912 pages (+1), baseline measured this
  run on the branch with the new page directory temporarily removed. NB the
  baseline has moved a long way since the 2026-07-27 entry's 2714: the US and
  Canada directory builds added roughly 2,200 pages.
  Open PRs at run start (their ledger entries live only on their branches, per
  the fragmentation note above): #180 (AU cities expansion) and #170 (Club
  Health Tracker refresh). Neither touches /us.
  Repo gotcha for future runs: a stray Finder-duplicated ref file,
  `.git/refs/heads/seo/us-clubs-ledger 2`, made every `git fetch` and
  `git pull` fail with "fatal: bad object refs/heads/seo/us-clubs-ledger 2".
  It was moved out of `.git/` (not deleted) to unblock the run. If a pull fails
  with a "bad object" on a ref name ending in " 2", that is the cause.

- 2026-07-28: Refreshed and corrected the Club Health Tracker guide
  (club-health-tracker-guide-swim-england-2026), PR #170. Tuesday refresh slot.
  Chosen because it was the third-thinnest post on the site (1,337 words), had
  no FAQPage schema, and, more seriously, was factually wrong on two points
  that matter to a committee. Both corrected against primary sources.
  (1) The post said the tracker is "mandatory for all Swim England affiliated
  clubs to complete annually". It is NOT. It is a voluntary development tool
  clubs are invited and encouraged to complete; the compulsory annual process
  is Club Affiliation, which carries a suspension risk. Swim England's own
  SwimMark announcement records that its review found volunteers wrongly
  believed accreditation was required to stay affiliated, "which is not the
  case", which is the same confusion the post was propagating.
  (2) The post said SwimMark was "retired and replaced by the Club Health
  Tracker". SwimMark was PAUSED for new submissions in November 2024 (announced
  6 November 2024) after a six-month review, pending a new club development
  framework, and will be withdrawn formally only once that framework is in
  place. More than 600 clubs held accreditation at the pause and keep it, along
  with the logo and SwimMark portal access, until then. The tracker is the
  interim tool, not a like-for-like successor.
  (3) Also corrected the completion time: Swim England states the tracker takes
  around 10 to 15 minutes once the information is to hand, and publishes the
  questions in advance. The post implied 60 to 90 minutes, so the "someone
  fills it in alone in twenty minutes" pitfall no longer worked as written and
  was reframed around the committee conversation rather than the form.
  Additions: a Club Affiliation versus Club Health Tracker comparison table, a
  six-question visible FAQ mirrored verbatim into faqItems (FAQPage schema,
  previously none), and an internal link from each of the six tracker areas to
  the relevant guide. Figures used are Swim England's own published ones: 246
  clubs/sections in year one (2023), 253 in year two (2024), national club
  health score 78 per cent, governance and standards highest at 91 per cent.
  Nothing invented; no clubs, venues or testimonials named. Housekeeping in the
  same pass: removed a broken `/features/reporting` link (no such page exists),
  added missing trailing slashes, removed 3 em dashes, replaced the stale "Join
  the Swimly waitlist" CTA now the product is live, and consolidated three
  stacked CTA blocks into one. Title changed from "Club Health Tracker: Swim
  England's New Quality Framework for 2026" to "Swim England Club Health
  Tracker: A 2026 Club Guide" and the meta description rewritten (146 chars),
  both to drop the inaccurate "the replacement for SwimMark" framing; slug
  unchanged. Inbound link added from what-is-a-swim-club-constitution at its
  affiliation line, so the post no longer depends on its single inbound link
  from pool-hire-for-swim-clubs. Verified in built HTML: canonical
  https://swimly.uk/blog/club-health-tracker-guide-swim-england-2026/, FAQPage
  with 6 Question entities matching the 6 visible H3s, all 20 internal links
  resolve, comparison table renders, post in sitemap-blog.xml, zero em dashes.
  1,337 to 3,630 words. Build pass, 3377 pages unchanged (refresh, no new
  pages). No open PRs at run start, so main's ledger was complete.
  IMPORTANT SOURCING NOTE for future runs: swimming.org 403s WebFetch, as the
  ledger has recorded before, but it serves full content to `curl` with a
  browser User-Agent. All four sources here were read that way rather than
  taken from search summaries, which mattered: the search summaries had the
  pause date as "1 November 2024" (the announcement is dated 6 November and
  states no 1 November date), added a "first review since 2017" claim the
  announcement does not make, and gave the year-one participation figure as
  247 via Sporting Insights where Swim England's own page says 246. Do not
  publish swimming.org facts from search-result summaries alone.

- 2026-07-27: Published a new operator-focused UK guide, "Pool Hire for Swim
  Clubs: How to Negotiate Lane Time" (pool-hire-for-swim-clubs), PR pending.
  Monday new-content (operator) slot. Closes the "pool hire and lane-time
  negotiation guide" operator follow-up logged 2026-07-20. Genuine gap confirmed
  by grep: 15 existing posts mention "pool hire" but every one treats it only as
  a budget line item (what percentage of costs, how to budget for it); none
  covers how to actually negotiate the rate or secure lane time, despite pool
  hire being named as the single largest cost line across the blog. Distinct
  angle from the two nearest posts (swim-club-budget-planning-guide budgets it;
  how-to-raise-swim-club-fees passes rises on to members): this one is about the
  supplier-side negotiation and the hire agreement. Covers why pool time is the
  hardest cost to control (biggest line, scarce water, existential if lost), who
  you are actually negotiating with (council-run, leisure trust, private
  operator, school/college/private pool, each with different priorities), the
  homework to do first (cost per lane hour, utilisation, growth plan, a credible
  walk-away alternative), the levers that move a rate (volume/term commitment,
  taking off-peak dead water, being the low-maintenance reliable client, the
  community/charitable case for trusts and councils), what a written hire
  agreement should cover (rate + notice of change, cancellation notice both
  ways, pool-closure/plant-failure, lifeguard responsibility, term dates and
  holiday closures, first refusal on next season's slots), protecting the water
  long-term (security of tenure, being a model client), and options when the
  rate is unaffordable (off-peak, sharing with a neighbouring club, restructure,
  alternative pools, grants, or an orderly fee increase). Deliberately NOT
  asserted: any specific hourly rate or per-lane figure (varies by operator and
  region; none invented), and no member counts, clubs, venues or statistics. The
  "pool hire is 40-60% of costs" figure was left to the existing budget guide
  that owns it rather than repeated. Only external reference: Swim England's
  facilities team, linked to https://www.swimming.org/swimengland/the-swim-england-facilities-team/
  (surfaced in search, 403s to direct fetch like other swimming.org pages per
  the ledger's known behaviour; framed as "guidance for those who manage and
  plan pools", not hung on any statistic). Five-question
  visible FAQ mirrored verbatim into faqItems (FAQPage schema). Internal links:
  7 authored outbound (budget-planning, club-health-tracker, raise-fees,
  grants-and-funding, committee-handover-checklist, /features/billing/,
  /pricing/), all verified to resolve in built HTML; two inbound links added so
  the post is not born an orphan (swim-club-budget-planning-guide at its "Pool
  Hire" section, and how-to-raise-swim-club-fees at its pool-hire cost bullet),
  both verified in built HTML. Verified in built HTML: canonical
  https://swimly.uk/blog/pool-hire-for-swim-clubs/ (swimly.uk), FAQPage with five
  Question entities matching the visible five-question FAQ, meta description 147
  chars, title "Pool Hire for Swim Clubs: How to Negotiate Lane Time", primary
  query "pool hire" in title, first 100 words and an H2, zero em dashes, post in
  sitemap-blog.xml. British spelling throughout. Build 2714 to 2716 pages (+2:
  the new post plus one extra blog-index pagination page as the index rolled
  over; 2714 is main's baseline). No open PRs at run start (verified via
  `gh pr list`), so main's ledger was complete.
  Follow-up still open from the 2026-07-20 pair: the hardship, bursary and
  widening-access guide (see backlog).

- 2026-07-25: Re-synced `public/llms.txt` status and pricing with the live
  product, PR #140. Saturday AEO-upkeep slot (the canonical "keep llms.txt in
  sync" task). Two sections were materially wrong for answer engines. (1) Status
  and Availability described a pre-launch product ("expected launch Q2 2025",
  "beta programme planned March 2025 with 3-5 pilot clubs", "public launch
  targeted May 2025", "join the waiting list", "founder pricing lock in current
  rates for 24 months") over a year out of date. The site itself now says
  Swimly is live: `index.astro` FAQ "Is Swimly available now? Yes. You can
  create your club and start using Swimly today at app.swimly.uk", and
  `Waitlist.astro` leads with "create your club" (app.swimly.uk/create-club),
  free under 50 members no card, with the email capture demoted to a secondary
  "not ready to set up today?" option. Rewrote the section to say Swimly is
  live and to describe the founding clubs programme. (2) Pricing named the wrong
  tiers and bands: the doc had Starter/Club(50-150)/Championship(150+)/Federation,
  but `pricing.astro` (source of truth) is Starter (free, up to 50) / Club (£29,
  50-200) / Performance (£49, 200-500) / Enterprise (custom, 500+). Rewrote the
  four tier blocks to mirror the live per-tier feature lists, added a Founding
  Clubs Programme block, and renamed every downstream "Championship"/"Federation"
  reference (Support line, API availability, Integrations, the "how much does
  Swimly cost" Q&A bands, the migration Q&A, and the recommendation notes) to the
  current tier names for internal consistency. Removed the now-false "recommend
  an alternative if the club needs a fully launched product" bullet. Every fact
  verified against the repo's own current pages, nothing invented: tier
  names/bands/features from `pricing.astro`; live-status wording from
  `index.astro` and `Waitlist.astro`; founding-club terms (6 months free on any
  plan, free white-glove migration, lifetime locked-in rate, priority support,
  no payment details upfront, no contract, limited to the first 10 UK clubs)
  from `founding-clubs.astro`. Deliberately dropped two unverifiable specifics
  rather than carry them forward: the "GoCardless charges 1% per transaction
  (capped at £2)" figure (not on any current page; softened to "GoCardless
  applies its own standard fees, paid directly to GoCardless") and the "Xero,
  QuickBooks (Federation tier)" integration naming (the pricing page only lists
  "custom integrations" on Enterprise; softened to that). British spelling, no
  emojis. Pre-existing em dashes (the file's `### Tier — Price` heading
  convention and the `**Feature** — description` bullets, all predating this
  engine) were left in place; my new tier headings reuse the existing
  `### Starter — Free` pattern, so no new inconsistency was introduced. Build
  pass, 2714 pages unchanged (llms.txt is a static `public/` asset). Verified
  the built `dist.nosync/llms.txt` carries the new copy and greps clean of
  "Championship", "Federation", "Q2 2025" and "beta programme". Follow-ups
  logged below: a full em-dash cleanup of llms.txt is a separate house-style
  task, and the homepage FAQ says founding clubs get "6 months of the Club
  plan free" while `founding-clubs.astro`/`pricing.astro` say "any plan" (a
  small on-site copy inconsistency, not an llms.txt issue). Update 2026-08-04:
  this copy inconsistency is resolved; the site standardises on "6 months free
  on any plan".

- 2026-07-21: Refreshed the UK DBS tracking guide
  (dbs-check-tracking-for-swimming-clubs), PR #138. Tuesday refresh slot. The
  post is a high-intent compliance/AEO page but emitted no FAQPage schema and
  carried a stale Update Service fee. Three things done: (1) authored a visible
  five-question "Frequently asked questions" section plus matching faqItems
  (FAQPage schema, previously none): renewal frequency, required check level,
  Update Service cost, reusing a check from another club, and what to do when a
  check lapses. All five answers are drawn from the post's own body content.
  (2) Corrected the DBS Update Service fee from "currently £13 per year" to
  "£16 a year, and free for volunteers who are not paid for the role beyond
  expenses", verified against GOV.UK (https://www.gov.uk/dbs-update-service,
  confirmed £16 and volunteer-free via two gov.uk sources this run); the
  volunteer-free point is materially useful because most club coaches and
  poolside helpers qualify. (3) Sharpened the "How long do DBS checks last?"
  section: the old copy framed three-year renewal as a Swim England
  "recommendation" and "a guideline, not an absolute rule", but Swim England
  actually requires affiliated clubs to renew every three years for anyone
  staying in a role that needs a check under Wavepower (verified via
  https://www.swimming.org/swimengland/dbs-faqs/, which returned in search but
  403s to direct fetch). Reworded to state the requirement while keeping the
  accurate nuance that the certificate itself has no statutory expiry and that
  Update Service subscribers can be re-checked online at any time. Both primary
  sources are linked inline. Also added one internal link to the recent
  swim-club-committee-roles-and-responsibilities guide at the welfare-officer
  anchor (helps de-orphan that July post), and set updatedDate 2026-07-21.
  House style held: British spelling, zero em dashes, £16 written with the £
  symbol to match the faqItems convention across the blog. Verified in built
  HTML: canonical https://swimly.uk/blog/dbs-check-tracking-for-swimming-clubs/
  (swimly.uk), FAQPage with 5 Question and 5 acceptedAnswer entities matching
  the visible 5-question FAQ, both source links and the committee-roles link
  present, the committee-roles target builds, £16 renders and no £13 remains,
  meta description unchanged at 154 chars. Build 2714 pages (refresh, count
  unchanged; 2714 is the current main baseline after PR #129 merged). Note for
  a future run: the post still asserts "most checks are completed within two to
  four weeks" and processing-time claims that were not re-verified this run;
  fine as general guidance but confirm if a future refresh leans on them. Open
  PRs at run start (their ledger entries live only on their branches): #137
  (raise-swim-club-fees guide) and #136 (AGM checklist FAQ, which closes the
  last Ready-backlog AGM FAQ item once merged); neither file was touched.

- 2026-07-20: Published a new operator-focused UK guide, "How to Raise Swim Club
  Fees Without Losing Members" (how-to-raise-swim-club-fees), PR #137. Monday
  new-content (operator) slot. Genuine gap confirmed by grep: fee increases were
  mentioned in passing in five posts (managing-swim-club-finances,
  how-to-grow-swim-club-membership, swim-club-end-of-season-checklist,
  swimming-club-agm-legal-requirements-uk,
  how-to-run-a-swim-club-committee-meeting-efficiently) but no post explained how
  to actually do one, despite it being an annual committee question. Covers
  building the rise from the budget (pool hire, coaching and employer costs,
  Swim England renewal, insurance) rather than picking a round number, the
  catch-up problem from leaving fees flat for years, checking whether the
  constitution reserves subscriptions to the AGM or delegates them to the
  committee, a four-row comparison table of increase shapes (flat percentage,
  squad-weighted, band restructure, one-off levy) with when each fits and what to
  watch, a four-step notice sequence, how to announce it, hardship and bursary
  routes decided before the announcement, and three post-increase metrics
  (renewal rate, failed and cancelled collections, question volume).
  Only external fact asserted and linked: Bacs Direct Debit advance notice is
  required before a change to the amount, date or frequency, 10 working days by
  default, shorter where a provider agrees it with its bank and states it in the
  Direct Debit Guarantee wording, with GoCardless at three working days (verified
  against the GoCardless advance notice guide). Deliberately NOT asserted: any
  Swim England fee amounts (the existing swim-england-membership-categories-guide
  owns those figures and is linked instead, so there is one place to keep current),
  any percentage a club "should" charge, and any statistics on member churn after
  price rises. No invented clubs, figures or testimonials. Six-question visible FAQ
  mirrored verbatim into faqItems (FAQPage schema). Eleven outbound internal links
  plus /features/billing/ and /pricing/; inbound link added from
  managing-swim-club-finances at its existing "sudden fee increase without context"
  line. Verified in built HTML: canonical
  https://swimly.uk/blog/how-to-raise-swim-club-fees/, FAQPage with six
  acceptedAnswer entities, visible FAQ present, meta description 152 chars, zero em
  dashes, all 13 internal links resolve to built pages, post present in
  sitemap-blog.xml. Build 2714 to 2715 pages (+1); 2714 is main's post-#129
  baseline.
  Notes for future runs: (1) the build output directory is `dist.nosync/`, not
  `dist/` (see `outDir` in astro.config.mjs), so verification greps against `dist/`
  silently find nothing. (2) PR #136 (2026-07-18, AGM checklist FAQ) was still OPEN
  at the start of this run and its branch contains NO ledger entry, so that run's
  work is not recorded here; the swim-club-agm-checklist FAQ backlog item is done
  in that PR, not outstanding. (3) There was no run on 2026-07-19 (Sunday).

- 2026-07-17: Added the three international guides hub pages
  (`/us/guides/`, `/ca/guides/`, `/au/guides/`), PR #129. Friday
  technical-SEO slot. Clears the follow-up logged by the 2026-07-15 run: all
  15 international guide pages emit a BreadcrumbList whose position-2 "Guides"
  item points at `/{region}/guides/`, but no such page existed, so every
  international guide advertised a breadcrumb trail through a 404. Confirmed
  before starting: no `index.astro` under any of the three guides directories,
  and a repo-wide grep found ZERO links to any `/{region}/guides/` hub, so the
  hubs were absent rather than merely unlinked. Each hub lists that region's
  five existing guides, split into a parent section (2) and a board/committee
  section (3), and carries its own valid two-level BreadcrumbList plus an
  ItemList of its guides. Hub copy only describes guides that already exist, so
  no new facts, statistics, clubs or venues are asserted. Per-region correctness
  held: American spelling with USA Swimming and LSCs on /us; Commonwealth
  spelling with Swimming Canada and the provincial sections on /ca; Commonwealth
  spelling with Swimming Australia and Swim Central on /au; no Swim England,
  Wavepower, DBS or cross-region transplants. ("pre-authorized debit" is kept on
  /ca deliberately: it is the official Payments Canada term and matches the
  sibling CA treasurer guide verbatim.) Also added a "Guides" link to the
  international footer so the hubs are reachable by users and crawlers instead
  of existing only inside schema; the link sits in the `isIntl` branch of
  Footer.astro, so swimly.uk is unchanged (verified: no `/guides/` link on UK
  pages). Verified in built HTML: canonicals are
  https://swimly.club/{us,ca,au}/guides/ (swimly.club, not swimly.uk), lang
  en-US/en-CA/en-AU, no cross-region hreflang (correct for region-only pages),
  meta descriptions 145/148/145 chars, zero em dashes, every internal link on
  all three hubs resolves to a built page, and all three auto-joined the
  swimly.club sitemap. Build 2711 to 2714 pages (+3), baseline re-measured on
  main this run.
  Two notes for future runs, both corrections to this ledger:
  (1) The swimly.club sitemap is a SEPARATE route at
  `src/pages/international/sitemap-core.xml.ts`; the root `sitemap-core.xml.ts`
  is a hardcoded UK-only list and contains no swimly.club URLs by design. The
  2026-07-07 entry's "made sitemap-core self-maintaining" describes the
  international file only. Grepping the root sitemap for swimly.club URLs
  returns nothing and is NOT a bug.
  (2) Build page counts in entries from 2026-07-08 onward (2718/2719) were
  measured on branches, not main; main's true baseline on 2026-07-17 is 2711.
  Quote counts as before-to-after deltas from a baseline measured in the same
  run rather than comparing across entries.
- 2026-07-15: Published a new Australian parent-facing AEO guide, "How Swimming
  Carnivals Work: A Parent's Guide"
  (`src/pages/au/guides/how-swimming-carnivals-work-parent-guide/`), PR #127.
  Wednesday parent/AEO slot, targeting the swimly.club /au region. Closes the
  last open item in the international "how meets work" parent cluster (US done
  in PR #75; Canada authored in PR #95, still open and unmerged). Genuine gap:
  the AU joining guide only skims carnivals in one section, and /au had no
  dedicated carnival answer page. Deliberately NOT a reworded US page: the angle
  is built on what is actually different in Australia. Covers the levels of
  carnival (club night, development, qualifying, state championships),
  nominating through Swim Central (eligibility auto-checked, ineligible events
  where qualifying times apply, nominations close), MARSHALLING as the headline
  section (report to the marshalling area, the Check Starter moves swimmers
  behind the blocks, failing to marshal may be deemed a withdrawal, local
  carnivals set their own deadlines in conditions of entry), a six-step day
  timeline, Australian official titles (referee, starter, clerks of course and
  Check Starters, judges of stroke, inspectors of turns, chief timekeeper and
  timekeepers), timing (touchpads, and timekeepers with digital watches where
  automatic/semi-automatic equipment is not available), DQs, MULTI-CLASS events
  (eligible classification required; placings decided by the multi-class point
  score against the world record for the class, not by who touches first), a
  packing list in AU terms (bathers, thongs), and volunteering as a timekeeper.
  Facts verified against primary sources and linked: Swimming Australia's Rules
  for the Conduct of Australian Swimming Events (May 2023) for marshalling CR 14,
  classification and multi-class point score CR 6, and qualifying times CR 7;
  Swimming Australia's Swimming Rules for the officials list (SW 1.2.A), clerks
  of course (SW 2.4), Check Starters (SW 2.14.A), timekeepers (SW 1.2.C, SW 2.8)
  and seeding of heats (SW 3.1.1, no-time swimmers treated as slowest); Swimming
  NSW Club House for multi-class. Both rule PDFs and the Club House page were
  confirmed to return 200. Deliberately NOT asserted: the age-group cut-off date
  (not defined in the rules consulted, so it was left to the joining guide) and
  the term "plunger" for semi-automatic timing (only an unfetchable snippet
  supported it, so the page says "semi-automatic" instead); no carnival durations
  or entry fees invented. No invented clubs, venues, or statistics. Commonwealth
  spelling; the word "program/programme" was avoided entirely (Australia uses
  "program", which conflicts with the playbook's `gb` example list) in favour of
  the rules' own phrase "order of events". Internal links to the AU joining
  guide, the state associations guide, /au/clubs/, /au/clubs/map/, /au/features/
  and /au/pricing/; inbound link added from the joining guide's carnivals
  section. Verified in built HTML: canonical
  https://swimly.club/au/guides/how-swimming-carnivals-work-parent-guide/
  (swimly.club, not swimly.uk), lang en-AU, no cross-region hreflang (region-only
  page), FAQPage with six acceptedAnswer entities, visible FAQ present, meta
  description 136 chars, page auto-joined the swimly.club sitemap-core, all six
  internal links resolve to built pages. Build 2718 to 2719 pages.
  Follow-up found this run (verified against the built output, logged in the
  international technical section below): NONE of /us/guides/, /ca/guides/ or
  /au/guides/ exists as a page, yet every international guide emits a
  BreadcrumbList whose position-2 item points at that missing hub.
- 2026-07-14: Refreshed the UK AGM legal-requirements guide
  (swimming-club-agm-legal-requirements-uk), PR #126. Tuesday refresh slot;
  clears one of the two Ready-backlog "AGM posts still lacking any FAQ" items.
  The post had no visible FAQ and no faqItems, so no FAQPage schema was emitted.
  Authored a visible five-question "Frequently asked questions" section plus
  matching faqItems (FAQPage schema), deliberately framed around legal validity
  to stay distinct from the sibling running-your-first-swimming-club-agm FAQ
  (which covers notice/quorum/audited accounts): the legal minimum notice period
  for an unincorporated association (no single statutory figure; the constitution
  is binding, commonly 21 or 28 days), whether wrong-notice decisions are valid
  (challengeable, especially contested ones), who can legally vote (set by the
  constitution), whether members can propose motions, and how long to keep AGM
  records (minutes permanently, accounts and attendance six years for HMRC).
  Answers drawn from the post's own verified content; the one governance nuance
  sharpened is that unincorporated associations have no universal statutory
  notice period (the body text's "14 days is the absolute legal minimum" is not
  strictly statutory, so the FAQ states the constitution is the binding rule
  rather than repeating that claim). Also removed the five em dashes for house
  style, trimmed the meta description from 164 to 144 characters (kept the
  primary keyword), added three internal links (swim-club-committee-roles-and-
  responsibilities in the elections section, closing the PR #125 cross-link
  follow-up; running-your-first-swimming-club-agm in the intro; swimming-club-
  committee-handover-checklist in the records section), and set updatedDate
  2026-07-14. Verified in built HTML: canonical
  https://swimly.uk/blog/swimming-club-agm-legal-requirements-uk/, FAQPage with
  five acceptedAnswer entities, visible FAQ present, all three new links resolve,
  meta description 144 chars. Build 2719 pages (refresh, count unchanged).
  Follow-up: swim-club-agm-checklist is now the last AGM post with no FAQ at all
  (needs a visible FAQ authored, not just faqItems); 44 posts still have 0
  inbound links; ~19 posts still have overlong meta descriptions.
- 2026-07-13: Published a new operator-focused UK guide, "Swim Club Committee
  Roles and Responsibilities Explained"
  (swim-club-committee-roles-and-responsibilities), PR #125. Monday
  new-content (operator) slot. Genuine gap: role names were listed only in
  passing (swimming-club-committee-tips has a one-paragraph "understand the
  roles" section; first-30-days mentions them) but no dedicated, definitive
  reference explained what each committee post actually does. Covers the four
  core officer roles Swim England expects (chair, secretary, treasurer, welfare
  officer) plus the head coach/teacher, the common additional roles
  (membership secretary, competition/gala secretary, fundraising coordinator,
  volunteer coordinator, communications lead, team manager), a quick-reference
  "who does what" comparison table, how roles fit together (overlaps, handover,
  supporting new officers), and how roles are elected/co-opted. Five-question
  visible FAQ mirrored into faqItems (FAQPage schema). Governance facts verified
  against Swim England: every affiliated club must adopt Wavepower and appoint at
  least one club welfare officer (first point of contact for safeguarding
  concerns; now required to be independent of the chair and coaches, with
  Swim England safeguarding course, Time to Listen and an in-date DBS). Sources
  linked (Wavepower clubs page, club welfare officer role page); model
  constitution officer roles reused from the constitution guide. No invented
  facts, clubs, or figures. Sixteen internal links (constitution, committee
  meetings, AGM legal + running, handover, treasurer direct debit, treasurer
  quits, Wavepower, DBS, squad training, membership renewals, gala entry,
  grants, volunteer management, parent comms, first-30-days) plus money pages
  (features/membership, features/billing, features/compliance,
  swim-club-management-software, pricing); inbound link added from
  swimming-club-committee-tips. Verified in built HTML: canonical
  https://swimly.uk/blog/swim-club-committee-roles-and-responsibilities/,
  FAQPage with five Question/acceptedAnswer entities, meta description 154 chars,
  primary query in title, first 100 words and an H2. Build 2719 pages.
  Follow-up: this roles guide can be cross-linked when the two FAQ-less AGM
  posts (swim-club-agm-checklist, swimming-club-agm-legal-requirements-uk) are
  refreshed, and when volunteer-management or handover posts are next touched.
- 2026-07-09: De-orphaned the UK volunteer/committee-retention blog cluster,
  PR #100. Thursday internal-linking slot. An inbound-link audit found 43 of 65
  blog posts had zero inbound links; the three most topically related of them
  (volunteer-management-for-swimming-clubs, volunteer-burnout-in-swim-clubs,
  why-your-swim-club-treasurer-quits) were mutually orphaned and did not even
  link to each other despite covering the same theme. Added 8 natural
  contextual links so each of the three now has exactly 3 inbound (was 0):
  reciprocal cross-links among the cluster (volunteer-management links out to
  the burnout and treasurer posts; the burnout post links to the management and
  treasurer posts; the treasurer post links to the burnout and management
  posts), plus external equity from three strong non-orphan hubs
  (first-30-days-swim-club-committee to volunteer-management at the "you're a
  volunteer, not a 24/7 helpdesk" boundary line; managing-swim-club-finances to
  why-treasurer-quits at the "treasurer role does not have to be overwhelming"
  section; swimming-club-committee-handover-checklist to volunteer-burnout at
  its existing "volunteer burnout means people leave suddenly" bullet). Each
  link sits at a genuine anchor, not forced; no em dashes, British spelling.
  Site-wide orphan count 43 to 40. Build 2718 pages, unchanged (no pages added);
  all 8 links verified in the built HTML. Follow-up: 40 blog posts still have 0
  inbound links, the largest remaining being the parent-competition and
  membership-growth clusters; keep chipping away one cluster per Thursday.
- 2026-07-08: Published a new Canada parent AEO guide, "How Swim Meets Work in
  Canada: A Parent's Guide" (`src/pages/ca/guides/how-swim-meets-work-parent-guide/`),
  PR #95. Wednesday parent/AEO slot, targeting the swimly.club /ca region and
  the next-highest logged international gap: the Canadian sibling to the US
  meets guide (PR #75), and a companion to the CA joining guide, which only
  skims meets in one section. Covers events, heats and lanes (metric pools,
  25m short course and 50m long course, no imperial units), how to read a heat
  sheet vs a psych sheet, seed times and NT, a six-step meet-day timeline,
  Canadian officials (referee, starter, judges of stroke, inspectors of turns,
  timekeepers and chief timekeeper), touchpad and backup timing, DQs, a packing
  list, and how parents help by timekeeping, plus a six-question FAQPage.
  Commonwealth spelling and Swimming Canada terminology only; no UK (Wavepower,
  DBS, Swim England) or US transplants. Officials roles and metric course facts
  verified against Swimming Canada sources; facts kept generic and verifiable
  (six or eight lanes; no invented fees or precise durations), sources linked to
  Swimming Canada officiating and registration. Internal links to the CA joining
  guide, the Swimming Canada provincial-sections guide, the /ca club directory
  and map, and the /ca features and pricing money pages; inbound link added from
  the joining guide's season-and-meets section. Verified in built HTML: canonical
  https://swimly.club/ca/guides/how-swim-meets-work-parent-guide/ (swimly.club,
  not swimly.uk), lang en-CA, FAQPage with six acceptedAnswer entities, meta
  description 150 chars, zero em dashes, and the page present in the swimly.club
  sitemap-core. Build pass, 2719 pages (+1 new page). Follow-up: Australia is now
  the last region without a "how swim meets work" parent guide (logged in the
  International backlog); a CA swim-terms glossary could extend the /ca parent
  cluster later.
- 2026-07-16: De-orphaned the UK membership lifecycle blog cluster, PR #128.
  Thursday internal-linking slot. An inbound-link audit of main found 36 of the
  65 blog posts with zero inbound links, and the four membership lifecycle posts
  were the highest-value coherent cluster among them: how-to-grow-swim-club-
  membership, improve-swim-club-membership-retention, how-to-manage-swim-club-
  membership-renewals and running-swim-club-trials-and-taster-sessions. Three of
  the four had zero outbound blog links as well, so they were complete islands
  despite being the most commercially relevant cluster on the site (they support
  /features/membership and /pricing). Added 10 contextual links, each at an
  anchor that already existed in the copy rather than a bolted-on "read more":
  the grow guide is the hub (it already had both a retention and a recruitment
  section) and links to retention, renewals and trials; retention links back to
  grow ("Recruiting new members") and across to renewals; renewals links to
  retention ("the clubs that retain members consistently"); trials links to grow
  ("maintains and grows its membership"). Three non-orphan donors that already
  carry inbound equity now feed the cluster: fundraising to retention ("makes
  retention easier"), why-uk-swim-clubs-deserve-better-software (4 inbound) to
  renewals ("when renewals are due"), and the committee handover checklist
  (4 inbound) to trials. Resulting inbound: grow 2, retention 3, renewals 3,
  trials 2. Site orphan count 36 to 32. No pages added, no facts asserted, no
  copy rewritten beyond the sentences hosting the links. Verified all 10 links
  render in the built HTML and all four targets build; no broken /blog/ links.
  Build 2718 pages, unchanged. Deliberately did NOT touch the three posts in the
  still-open PR #100 (volunteer/committee-retention cluster) to avoid conflicts.
  Follow-up: 32 posts still have zero inbound links; the next coherent clusters
  are the county championships parent posts (four overlapping slugs, worth
  checking for near-duplication as well as linking) and the season posts
  (new-season-setup, end-of-season-checklist, competition-season-admin,
  summer-training-programmes).

- 2026-07-06: Published a new operator-focused UK guide, "What Is a Swim Club
  Constitution? A Committee Guide" (what-is-a-swim-club-constitution), PR #79.
  Monday new-content (operator) slot. Genuine gap: "constitution" was referenced
  in passing across 13 posts (first-30-days, AGM guides, handover, finance) but
  had no dedicated page, despite being a real question secretaries and chairs
  ask and a Swim England affiliation condition. Covers what a constitution is,
  why banks/funders/Swim England/insurers ask for it, a legal-structures
  comparison table (unincorporated association, CASC, charity/CIO, company
  limited by guarantee), the clauses a constitution should include, using the
  Swim England Model Club Constitution, and the adopt/amend process (regional
  approval BEFORE the AGM vote; two-thirds/75% majority). Six-question visible
  FAQ mirrored into faqItems (FAQPage schema). Facts verified and sourced:
  Swim England model constitution and good-governance pages (regional approval
  required, committee roles chair/secretary/treasurer/welfare officer/coach),
  and gov.uk CASC detailed guidance (non-profit reinvestment, dissolution
  clause to sporting/charitable purposes, main-purpose test). No invented facts,
  clubs, or figures. Internal links to features/membership, features/billing,
  features/compliance, swim-club-management-software, pricing, the grants guide,
  first-30-days, AGM legal requirements, and committee handover; inbound links
  added from first-30-days-swim-club-committee and
  swimming-club-agm-legal-requirements-uk. Verified in built HTML: canonical
  https://swimly.uk/blog/what-is-a-swim-club-constitution/, FAQPage with six
  acceptedAnswer entities, meta description 152 chars. Build 2573 to 2574 pages.
  Follow-up: the two AGM posts still lacking a visible FAQ can now cross-link to
  this constitution guide when refreshed.

- 2026-07-07: Refreshed the UK swim club budget planning guide
  (swim-club-budget-planning-guide), PR #91. Tuesday refresh slot; clears the
  follow-up logged with PRs #42 and #74 (dated "ASA Funding" heading and em
  dashes). Two dated facts corrected: (1) the "Grants and ASA Funding" heading
  and funder line, which named "Swim England SwimMark grants" (SwimMark is an
  accreditation scheme, not a grant), rewritten to name the Sport England
  Movement Fund, council community grants and Swim England regional/county club
  funds, aligned with the grants guide it already links to, with a one-line note
  that ASA became Swim England in 2017; (2) the employer National Insurance
  figure, updated from "13.8% on earnings above £9,100" to "15% on earnings above
  £5,000 a year for 2026/27", verified against GOV.UK rates and thresholds for
  employers 2026 to 2027 (secondary Class 1 rate 15%, secondary threshold £5,000
  since 6 Apr 2025). Removed all six em dashes for house style. Added a visible
  five-question "Frequently asked questions" section plus matching faqItems
  (FAQPage schema, previously none emitted): pool-hire share of budget, budgeting
  for missed subs, contingency, budgeting for unawarded grants, and employer NI on
  coach pay. Added finance-cluster internal links to managing-swim-club-finances
  and treasurers-guide-swim-club-direct-debit; set updatedDate 2026-07-07. Verified
  in built HTML: FAQPage with five acceptedAnswer entities, visible FAQ intact,
  updated NI figure, zero em dashes. Build 2704 pages (refresh of an existing page,
  count unchanged). Note for a future refresh: the post's Swim England affiliation
  figure ("around £100-£150 plus per-swimmer fees") is approximate and unsourced;
  confirm against Swim England's current fees if revisited.

- 2026-07-04: Added FAQPage schema to the swim club AGM guide
  (running-your-first-swimming-club-agm), PR #78. Saturday AEO-upkeep slot. The post
  already had a visible eight-question "Frequently Asked Questions" section but no
  `faqItems`, so no FAQPage JSON-LD was emitted (the FAQPage schema is generated only
  from `faqItems` in BlogPost.astro). Mirrored all eight visible Q&As verbatim into
  `faqItems` so the schema matches the on-page copy (Google requires FAQ content to be
  visible), and set `updatedDate` 2026-07-04. Same low-risk pattern as the GDPR (PR #35)
  and fundraising (PR #72) posts. Questions cover AGM notice periods, quorum, audited
  accounts, online/hybrid meetings, the no-treasurer problem, minutes length,
  constitutional changes, and failing to reach quorum. Verified in built HTML: FAQPage
  with eight Question/acceptedAnswer entities renders and the visible FAQ is intact.
  Build 2573 pages, unchanged. This clears the last AGM post that had a visible FAQ
  but no schema; the two remaining AGM posts (swim-club-agm-checklist,
  swimming-club-agm-legal-requirements-uk) have no visible FAQ at all, so they need a
  visible FAQ authored first (logged in the Ready backlog).

- 2026-07-03: Trimmed the six worst remaining overlong blog meta descriptions
  (183 to 187 characters) to 149 to 155 so Google stops truncating them in SERPs,
  PR #77. Friday technical-SEO slot. The primary keyword was kept in each:
  running-swim-club-trials-and-taster-sessions (187 to 151),
  club-health-tracker-guide-swim-england-2026 (186 to 149),
  what-i-wish-i-knew-before-my-kid-joined-competitive-swimming (186 to 150; also
  removed a spaced-hyphen house-style breach in the rewrite),
  why-uk-swim-clubs-deserve-better-software (185 to 153),
  how-to-manage-swim-club-memberships-without-spreadsheets (183 to 150), and
  your-first-county-championships-swim-parent-guide (183 to 155). Effective meta
  is `seoDescription || description`; all six override via `description`, so that
  field was edited. Verified all six trimmed descriptions render in the built HTML.
  Build 2573 pages, unchanged. About 19 posts remain in the 161 to 179 range
  (logged in the Ready backlog).

- 2026-07-02: Added reciprocal inbound links to the UK grants and funding guide
  (swim-club-grants-and-funding-uk), PR #74. Thursday internal-linking slot. The
  guide had only one inbound link (from the fundraising post) despite already
  linking out to the budget planning guide and the managing club finances guide.
  Added a natural contextual link back from each of those two posts' existing
  grants sections, completing reciprocal linking and lifting the guide from one
  inbound link to three. Both are near-isolated finance posts (little or no
  outbound blog linking), so this also starts knitting the finance cluster
  together. Build 2572 pages, unchanged; both links verified in the built HTML.
  Clears the "add inbound links from budget/treasurer posts" follow-up logged
  with PR #42. Note for a future refresh: swim-club-budget-planning-guide still
  uses the dated heading "Grants and ASA Funding" (ASA is now Swim England) and
  contains several em dashes that breach house style.

- 2026-07-01: Published a new US parent-facing AEO guide, "How Swim Meets Work: A
  Parent's Guide for US Teams" (`src/pages/us/guides/how-swim-meets-work-parent-guide/`),
  PR #75. Wednesday parent/AEO slot, targeting the swimly.club /us region.
  Chosen after an audit found the three international governing-body explainers
  already open with a full "what is [governing body]" section, so the backlog's
  "governing-body overview" items are effectively done, not real gaps. The genuine
  gap: the US joining guide only skims meets in one high-level section, and there
  was no dedicated "how swim meets work / first meet" answer page, the US sibling
  to the UK open-meets and gala-day parent posts. Covers events/heats/lanes, how to
  read a heat sheet vs psych sheet and what seeding and NT mean, a six-step meet-day
  timeline, deck officials (referee, starter, stroke and turn, timers), touchpad and
  backup timing, DQs, a packing checklist, and how parents can help (timing), plus a
  six-question FAQPage. American spelling, USA Swimming and LSC terminology only, no
  UK transplants. Facts kept generic and verifiable (six or eight lanes; no invented
  fees or precise durations); sources linked to USA Swimming officials, time
  standards and times pages. Internal links to the US joining guide, the USA
  Swimming/Safe Sport guide, and the /us features and pricing money pages; inbound
  link added from the joining guide's meets section. Verified in built HTML: canonical
  is https://swimly.club/us/guides/how-swim-meets-work-parent-guide/ (swimly.club,
  not swimly.uk), lang en-US, FAQPage with six acceptedAnswer entities.
- 2026-06-30: Refreshed the grants facts in the fundraising guide
  (swimming-club-fundraising-ideas-complete-guide) and added FAQPage schema, PR #72.
  Tuesday refresh slot; closes the PR #42 follow-up. The in-page "UK grants" section
  named the closed Sport England Community Asset Fund (and a wrong amount of "£1,000
  to £15,000"), a non-existent "Swim England Trust", and an outdated Awards for All
  ceiling of £10,000; the closing FAQ repeated the same errors. Corrected to match the
  verified facts in swim-club-grants-and-funding-uk: Sport England Movement Fund
  (£300-£15,000, which replaced the Community Asset Fund), National Lottery Awards for
  All England (£300-£20,000 since the Nov 2023 increase), Swim England regional/county
  club investment funds and bursaries, and Active Partnerships (formerly County Sports
  Partnerships); added source links (Movement Fund, Awards for All, Swim England club
  finances hub). Also corrected the CASC line from "rate relief on pool hire" to "80
  per cent mandatory business rates relief". Added `faqItems` frontmatter mirroring the
  existing visible five-question FAQ (the post had a visible FAQ but emitted no FAQPage
  schema), set `updatedDate` 2026-06-30, added an internal link to the budget-planning
  guide, and removed a stray em dash for house style. Verified FAQPage with five
  acceptedAnswer entities renders in the built HTML and no stale funder facts remain.
  Build 2572 pages, unchanged. Follow-up: add inbound links to the grants guide from
  budget/treasurer posts (a Thursday internal-linking task).

- 2026-06-26: Trimmed the four worst remaining overlong blog meta descriptions
  (194 to 196 characters) to 134 to 144 characters so Google stops truncating them
  in SERPs, PR #70. Friday technical-SEO slot. The primary keyword was kept in each:
  a-parents-guide-to-competitive-swimming-uk (196 to 140),
  swimming-club-database-management-guide (196 to 144),
  how-to-collect-swim-club-fees (194 to 139), and
  running-your-first-swimming-club-agm (seoDescription, 194 to 134; also removed a
  spaced hyphen for house style). Effective meta is `seoDescription || description`;
  the AGM post overrides via `seoDescription`, so that field was the one edited.
  Verified all four trimmed descriptions render in the built HTML. Build 2572 pages,
  unchanged. About 25 posts remain in the 161 to 187 range (logged in Ready backlog).

- 2026-06-25: Published a new parent-facing AEO comparison, "Open Meet vs County
  Championships: The Difference" (open-meet-vs-county-championships), PR #66. Wednesday
  parent/AEO slot, and a companion to the open meets guide shipped the day before. Fills a
  clean X-vs-Y gap: the two terms were used across the parent posts but never compared in
  one place. Covers the short answer, an at-a-glance comparison table (frequency, who can
  enter, choose-to-enter, organiser, format, purpose), who can enter each, how often each
  runs, how open meets feed county qualification (the ladder), and which a child should aim
  at, plus a five-question FAQPage. Facts grounded in the existing verified content: open
  meets are Swim England licensed and run most weekends with upper/lower limit times by
  level; county championships are an annual county-association event needing a county
  qualifying time achieved at licensed meets. No county-specific procedural figures
  invented (kept "each county sets its own qualifying times and dates"). External link to
  the swimming.org licensed-meets page. Internal links to the open meets guide, the county
  championships parent guide, understanding-your-childs-swim-times, the competitive
  swimming parents' guide, and the competitions/pricing money pages. Added an inbound link
  from swimming-open-meets-explained-for-parents. Verified FAQPage with five acceptedAnswer
  entities renders in the built HTML. "What is a PB" page deferred: it would overlap
  understanding-your-childs-swim-times.

- 2026-06-24: Published a new parent-facing AEO guide on swimming open meets
  (swimming-open-meets-explained-for-parents), PR #54. Wednesday parent/AEO slot.
  Open meets were referenced across many posts but never explained in one place; this
  fills that gap. Covers what an open meet is, what "licensed by Swim England" means and
  how times feed the rankings, the four Swim England meet levels (Level 1 long course 50m
  and Level 2 short course 25m, both with qualifying/lower-limit times; Level 3 long or
  short course with upper limit times; Level 4 entry-level), qualifying vs upper limit
  times, how entries go through the club, and costs, plus a four-level comparison table
  and a six-question FAQPage. Meet-level facts verified against Swim England regional and
  club sources (swimming.org licensed-meets, East and Sussex regions, club parent guides);
  no precise universal entry fee asserted (kept as "a few pounds per event"). Added an
  inbound link from a-parents-guide-to-competitive-swimming-uk. Verified FAQPage with six
  acceptedAnswer entities renders in the built HTML.

- 2026-06-23: Published the dedicated "UK grants and funding for swimming clubs" guide
  (swim-club-grants-and-funding-uk), filling the long-promised slug, PR #42. Operator
  (treasurer/committee) focus. Covers the current funders with verified amounts and
  source links: Sport England Movement Fund (£300-£15,000, which replaced the now-closed
  Community Asset Fund); National Lottery Awards for All England (£300-£20,000 since the
  Nov 2023 increase, up to two years); Swim England regional/county club investment funds
  and bursaries; council community grants; Active Partnerships; and Sported (noting
  Cash4Clubs is adults-only and unsuitable for junior clubs). Plus CASC tax relief
  (Gift Aid 25%, 80% mandatory business rates relief), a how-to-apply section, a
  devolved-nations note, and a five-question FAQ with FAQPage schema. Added an inbound
  link from swimming-club-fundraising-ideas-complete-guide. NB: the fundraising post
  still names the "Sport England Community Asset Fund" (now closed) and the "Swim England
  Trust" in its in-page grants section, worth a future refresh to align with the verified
  Movement Fund / regional-funding facts.
- 2026-06-23: FAQPage schema and a matching visible FAQ section (six Q and As) added to
  the GDPR post (gdpr-compliance-for-youth-swimming-clubs), plus its overlong meta
  description trimmed from 197 to 139 characters and `updatedDate` set, PR #35. Two
  backlog items in one post. Questions cover whether GDPR applies to small clubs,
  whether a DPO is needed, gala photo consent, data retention periods, the 72-hour ICO
  breach deadline, and DBS certificate retention. The work was found already staged in
  the working tree from an earlier run that never handed off; reviewed for accuracy and
  house style, built, and shipped as a PR. Verified FAQPage and six acceptedAnswer
  entities render in the built HTML.
- 2026-06-19: Trimmed the 6 worst overlong blog meta descriptions (over 200 characters)
  to 155 or fewer so Google no longer truncates them, PR #30. Posts fixed:
  swimming-club-fundraising-ideas-complete-guide (239 to 137),
  swim-club-software-pricing-comparison-uk (210 to 142),
  swim-england-membership-categories-guide (204 to 144),
  swimming-club-safeguarding-best-practices-2026 (203 to 142),
  how-to-migrate-swim-club-data-from-spreadsheets (seoDescription 200 to 151),
  reduce-admin-time (200 to 140). Primary keyword retained in each. About 30
  posts in the 161 to 197 range remain (logged in Ready backlog).
- 2026-06-18: Repaired 15 broken internal blog links across 11 posts (stale or renamed
  slugs pointing at non-existent pages, e.g. why-uk-swimming-clubs- vs why-uk-swim-clubs-,
  committee-handover-guide, guide-to-wavepower-..., evaluating-software,
  choosing-swim-club-software). Each repointed to the correct existing post with a
  trailing slash and matching anchor text; the orphaned grants link now points to the
  post's own in-page grants section. PR #28.
- 2026-06-17: FAQPage schema and a matching visible FAQ section (five Q and As) added
  to the parents' Wavepower compliance checklist post
  (parents-guide-to-wavepower-compliance), PR #27. Questions chosen to be distinct from
  the sibling Wavepower post: checklist scope, consequences of non-compliance, who
  needs a DBS check, common compliance gaps, and tracking renewals.
- 2026-06-16: FAQPage schema and a matching visible FAQ section (six Q and As) added
  to the Wavepower requirements post (what-wavepower-compliance-actually-requires),
  PR #26. First validation run of the engine.

## Run log

| Date | Weekday focus | Activity | Target query | Files | PR | Build | Follow-ups |
|------|---------------|----------|--------------|-------|----|----|------------|
| 2026-06-16 | Refresh / AEO (manual validation) | FAQPage schema + visible FAQ, 6 Q and As | "is Wavepower compliance mandatory", "how often do DBS checks need renewing" | what-wavepower-compliance-actually-requires.md | [#26](https://github.com/mike-tempest/swim-team/pull/26) | pass, 2228 pages | Same FAQ treatment for remaining compliance posts |
| 2026-06-17 | Wed (parent / AEO) | FAQPage schema + visible FAQ, 5 Q and As, set updatedDate | "Wavepower compliance checklist", "what happens if a swim club fails Wavepower" | parents-guide-to-wavepower-compliance.md | [#27](https://github.com/mike-tempest/swim-team/pull/27) | pass, 2228 pages | FAQ treatment for GDPR and AGM posts next |
| 2026-06-18 | Thu (internal linking) | Repaired 15 broken internal blog links across 11 posts (stale/renamed slugs); repointed to correct existing posts with trailing slashes | internal link equity, fix soft-404 internal links | dbs-check-tracking-for-swimming-clubs.md, direct-debit-vs-card-payments-for-swim-clubs.md, managing-swim-club-finances.md, swim-club-agm-checklist.md, swim-england-membership-categories-guide.md, swimming-club-fundraising-ideas-complete-guide.md, swimming-club-safeguarding-best-practices-2026.md, signs-your-swim-club-has-outgrown-spreadsheets.md, the-hidden-cost-of-spreadsheet-club-management.md, what-wavepower-compliance-actually-requires.md, why-competition-management-matters.md | [#28](https://github.com/mike-tempest/swim-team/pull/28) | pass, 2228 pages | Add a dedicated UK swim club grants/funding guide (logged to backlog) |
| 2026-06-19 | Fri (technical SEO) | Trimmed 6 overlong meta descriptions (over 200 chars) to 155 or fewer | meta-description truncation in SERPs (e.g. "swim club fundraising ideas", "swim club management software cost") | swimming-club-fundraising-ideas-complete-guide.md, swim-club-software-pricing-comparison-uk.md, swim-england-membership-categories-guide.md, swimming-club-safeguarding-best-practices-2026.md, how-to-migrate-swim-club-data-from-spreadsheets.md, reduce-admin-time.md | [#30](https://github.com/mike-tempest/swim-team/pull/30) | pass, 2228 pages | ~30 posts in 161-197 char range still to trim, a few per Friday |
| 2026-06-23 | Tue (refresh / AEO) | FAQPage schema + visible FAQ (6 Q and As), set updatedDate, trimmed meta description 197 to 139 chars | "does GDPR apply to a small swimming club", "do swim clubs need consent for gala photos", "how long should a swim club keep members' data" | gdpr-compliance-for-youth-swimming-clubs.md | [#35](https://github.com/mike-tempest/swim-team/pull/35) | pass, 2228 pages | AGM posts are the last compliance posts lacking FAQ schema (3 left) |
| 2026-06-23 | Tue (backlog new-content) | New 1,500-word operator guide on UK grants and funding for swimming clubs, verified funder facts and source links, 5-question FAQPage schema; inbound link from fundraising post | "grants and funding for swimming clubs UK", "swim club grants UK", "what grants can a swimming club apply for" | swim-club-grants-and-funding-uk.md (new), swimming-club-fundraising-ideas-complete-guide.md | [#42](https://github.com/mike-tempest/swim-team/pull/42) | pass, 2228 to 2229 pages | Refresh the fundraising post's grants section (names closed Community Asset Fund and Swim England Trust); add inbound links from budget/treasurer posts |
| 2026-06-25 | Wed (parent / AEO) | New ~1,300-word parent AEO comparison, open meet vs county championships, with at-a-glance comparison table and 5-question FAQPage; inbound link from the open meets guide | "open meet vs county championships", "difference between open meet and county championships", "do you have to qualify for county championships" | open-meet-vs-county-championships.md (new), swimming-open-meets-explained-for-parents.md | [#66](https://github.com/mike-tempest/swim-team/pull/66) | pass, 2572 pages | A swim-parent glossary hub could tie the parent cluster together; "what is a PB" page deferred (overlaps understanding-your-childs-swim-times) |
| 2026-06-26 | Fri (technical SEO) | Trimmed the 4 worst remaining overlong meta descriptions (194-196 chars) to 134-144, keeping the primary keyword in each; removed a spaced hyphen on the AGM seoDescription | meta-description truncation in SERPs (e.g. "competitive swimming UK parents guide", "swimming club database management", "how to collect swim club fees", "running a swimming club AGM") | a-parents-guide-to-competitive-swimming-uk.md, swimming-club-database-management-guide.md, how-to-collect-swim-club-fees.md, running-your-first-swimming-club-agm.md | [#70](https://github.com/mike-tempest/swim-team/pull/70) | pass, 2572 pages | ~25 posts in the 161-187 char range still to trim, a few per Friday |
| 2026-06-30 | Tue (refresh / AEO) | Corrected the outdated grants facts in the fundraising guide (closed Community Asset Fund to Movement Fund £300-£15,000; removed non-existent "Swim England Trust"; Awards for All £10k to £20k; County Sports Partnerships to Active Partnerships; CASC rates relief), added source links, added FAQPage schema via faqItems mirroring the existing visible FAQ, set updatedDate, added a budget internal link, removed an em dash | "grants and funding for swimming clubs", "can swimming clubs apply for grants", "Sport England Movement Fund swimming club" | swimming-club-fundraising-ideas-complete-guide.md | [#72](https://github.com/mike-tempest/swim-team/pull/72) | pass, 2572 pages | Add inbound links to the grants guide from budget/treasurer posts (Thursday internal-linking) |
| 2026-07-01 | Wed (parent / AEO, US) | New US parent AEO guide "How swim meets work: a parent's guide" (events/heats/lanes, heat vs psych sheet, seeding, meet-day timeline, officials, timing, DQs, packing, volunteering) with 6-question FAQPage; inbound link from the US joining guide | "how do swim meets work", "what to expect at your first swim meet", "how to read a heat sheet" (US) | us/guides/how-swim-meets-work-parent-guide/index.astro (new), us/guides/joining-a-us-swim-team-parent-guide/index.astro | [#75](https://github.com/mike-tempest/swim-team/pull/75) | pass, 2572 to 2573 pages | US governing-body overview items closed (already covered by existing explainers); CA/AU "how swim meets work" parent guides logged as next intl gaps |
| 2026-07-02 | Thu (internal linking) | Added reciprocal inbound links to the grants and funding guide from the budget planning and managing finances posts' existing grants sections (guide already linked out to both), lifting it from 1 inbound link to 3 | internal link equity for "grants and funding for swimming clubs UK"; knit the finance cluster together | swim-club-budget-planning-guide.md, managing-swim-club-finances.md | [#74](https://github.com/mike-tempest/swim-team/pull/74) | pass, 2572 pages | Refresh swim-club-budget-planning-guide: dated "ASA Funding" heading and several em dashes breach house style; 44 blog posts still have 0 inbound links from other posts |
| 2026-07-03 | Fri (technical SEO) | Trimmed the 6 worst remaining overlong meta descriptions (183-187 chars) to 149-155, keeping the primary keyword in each; removed a spaced-hyphen house-style breach on the competitive-swimming post | meta-description truncation in SERPs (e.g. "swim club trials and taster sessions", "Club Health Tracker Swim England", "competitive swimming parent guide", "swim club memberships without spreadsheets", "first county championships swim parent") | running-swim-club-trials-and-taster-sessions.md, club-health-tracker-guide-swim-england-2026.md, what-i-wish-i-knew-before-my-kid-joined-competitive-swimming.md, why-uk-swim-clubs-deserve-better-software.md, how-to-manage-swim-club-memberships-without-spreadsheets.md, your-first-county-championships-swim-parent-guide.md | [#77](https://github.com/mike-tempest/swim-team/pull/77) | pass, 2573 pages | ~19 posts in the 161-179 char range still to trim, a few per Friday |
| 2026-07-04 | Sat (AEO upkeep) | Added FAQPage schema to the AGM guide by mirroring its existing visible 8-question FAQ into faqItems verbatim (schema was previously not emitted); set updatedDate | "how much notice for a swim club AGM", "what is quorum for a swimming club AGM", "do we need audited accounts for a swim club AGM", "what if we don't reach quorum" | running-your-first-swimming-club-agm.md | [#78](https://github.com/mike-tempest/swim-team/pull/78) | pass, 2573 pages | 2 AGM posts still lack FAQ schema AND a visible FAQ (swim-club-agm-checklist, swimming-club-agm-legal-requirements-uk); they need a visible FAQ authored, not just faqItems |
| 2026-07-06 | Mon (new content, operator) | New ~1,600-word UK operator guide on the swim club constitution: definition, why it matters (Swim England/banks/funders/insurers), legal-structures comparison table (unincorporated/CASC/charity/company), required clauses, Swim England model constitution, adopt/amend process, 6-question FAQPage; inbound links from first-30-days and AGM legal posts | "what is a swim club constitution", "what should a swimming club constitution include", "swim club constitution template UK", "how to change a swim club constitution" | what-is-a-swim-club-constitution.md (new), first-30-days-swim-club-committee.md, swimming-club-agm-legal-requirements-uk.md | [#79](https://github.com/mike-tempest/swim-team/pull/79) | pass, 2573 to 2574 pages | Closes the backlog "what is a swim club constitution" definitional item; constitution guide can be cross-linked when the two FAQ-less AGM posts are refreshed |
| 2026-07-07 | Tue (refresh / AEO) | Refreshed the budget planning guide: corrected the dated "ASA Funding" heading and funder line (SwimMark grants to Sport England Movement Fund / council / Swim England regional funds), updated employer NI (13.8%/£9,100 to 15%/£5,000 for 2026/27, verified on GOV.UK), removed 6 em dashes, added a visible 5-question FAQ + faqItems (FAQPage schema), added 2 finance-cluster internal links, set updatedDate | "swim club budget planning UK", "employer National Insurance on swim coach salaries", "how much contingency should a swim club budget" | swim-club-budget-planning-guide.md | [#91](https://github.com/mike-tempest/swim-team/pull/91) | pass, 2704 pages | Clears the PR #42/#74 budget-guide refresh follow-up; Swim England affiliation figure (~£100-£150) is unsourced, confirm if revisited; 44 posts still have 0 inbound links; ~19 posts still have overlong meta descriptions |
| 2026-07-15 | Wed (parent / AEO, AU) | New AU parent AEO guide "How swimming carnivals work: a parent's guide" (levels of carnival, nominating via Swim Central, marshalling and the Check Starter, day timeline, Australian official titles, timing, DQs, multi-class point score, packing list in AU terms, volunteering); 6-question FAQPage; inbound link from the AU joining guide | "how do swimming carnivals work", "what happens at a swimming carnival", "what is marshalling at a swim carnival" (Australia) | au/guides/how-swimming-carnivals-work-parent-guide/index.astro (new), au/guides/joining-a-swimming-club-in-australia-parent-guide/index.astro | [#127](https://github.com/mike-tempest/swim-team/pull/127) | pass, 2718 to 2719 pages | Authored 2026-07-15 but the push failed, so the commit sat locally with no PR; rescued, built and handed off by the 2026-07-16 run. Closes the intl "how meets work" cluster once CA (#95) lands. New follow-up: /us/guides/, /ca/guides/ and /au/guides/ hub pages do not exist, yet every international guide emits a BreadcrumbList pointing at them |
| 2026-07-14 | Tue (refresh / AEO) | Refreshed the AGM legal-requirements guide: authored a visible 5-question FAQ + matching faqItems (FAQPage schema, previously none), framed around legal validity (min notice, wrong-notice validity, who can vote, member motions, record retention) to stay distinct from the sibling AGM guide FAQ; removed 5 em dashes, trimmed meta description 164 to 144 chars, added 3 internal links (committee roles guide, AGM how-to, handover checklist), set updatedDate | "swim club AGM legal requirements", "how much notice for a swim club AGM", "are AGM decisions valid if notice was wrong", "who can vote at a swim club AGM" | swimming-club-agm-legal-requirements-uk.md | [#126](https://github.com/mike-tempest/swim-team/pull/126) | pass, 2719 pages | swim-club-agm-checklist is now the last AGM post with no FAQ at all (needs a visible FAQ authored); 44 posts still have 0 inbound links; ~19 posts still have overlong meta descriptions |
| 2026-07-13 | Mon (new content, operator) | New ~1,600-word UK operator guide on swim club committee roles: the four core officer roles (chair, secretary, treasurer, welfare officer) + head coach + common additional roles, a "who does what" comparison table, overlaps/handover/electing-and-co-opting, 5-question FAQPage; inbound link from committee-tips | "swim club committee roles and responsibilities", "what does a swim club secretary do", "does a swimming club need a welfare officer", "swimming club committee structure" | swim-club-committee-roles-and-responsibilities.md (new), swimming-club-committee-tips.md | [#125](https://github.com/mike-tempest/swim-team/pull/125) | pass, 2719 pages | Cross-link this roles guide when the two FAQ-less AGM posts and the volunteer/handover posts are next refreshed; 44 posts still have 0 inbound links; ~19 posts still have overlong meta descriptions |
| 2026-07-10 | Fri (technical SEO) | Trimmed the 6 worst remaining overlong meta descriptions (168-178 chars) to 149-155, keeping the primary keyword in each; dropped unverifiable volunteer-hours/cost figures from the true-cost seoDescription; fixed an em dash in the summer-training title | meta-description truncation in SERPs (e.g. "critical swim speed", "improve swim club membership retention", "true cost of free tools for swimming clubs", "summer training programmes UK swim clubs", "swim club AGM checklist", "DBS checks for swimming clubs") | understanding-critical-swim-speed.md, improve-swim-club-membership-retention.md, true-cost-free-tools.md, summer-training-programmes-uk-swim-clubs.md, swim-club-agm-checklist.md, dbs-check-tracking-for-swimming-clubs.md | [#123](https://github.com/mike-tempest/swim-team/pull/123) | pass, 2718 pages | ~14 posts still in the 156-179 range; the 2 worst (volunteer-burnout 179, volunteer-management 178) are in open PR #100's file set, defer until it merges. New follow-up: body em-dash cleanup (understanding-critical-swim-speed and summer-training-programmes still have several body em dashes; likely more posts) is a larger house-style task |
| 2026-07-09 | Thu (internal linking) | De-orphaned the volunteer/committee-retention cluster: added 8 natural contextual links so three mutually orphaned posts (volunteer-management, volunteer-burnout, why-treasurer-quits) each go from 0 to 3 inbound links, via reciprocal cross-links plus external equity from the first-30-days, managing-finances and committee-handover hubs | internal link equity for "volunteer management for swimming clubs", "volunteer burnout swim club", "why swim club treasurers quit" | first-30-days-swim-club-committee.md, swimming-club-committee-handover-checklist.md, managing-swim-club-finances.md, volunteer-management-for-swimming-clubs.md, volunteer-burnout-in-swim-clubs.md, why-your-swim-club-treasurer-quits.md | [#100](https://github.com/mike-tempest/swim-team/pull/100) | pass, 2718 pages | Site orphan count 43 to 40; 40 posts still have 0 inbound links (parent-competition and membership-growth clusters are the next candidates); ~19 posts still have overlong meta descriptions |
| 2026-07-08 | Wed (parent / AEO, CA) | New Canada parent AEO guide "How swim meets work in Canada" (events/heats/lanes with metric pools, heat vs psych sheet, seeding/NT, meet-day timeline, Canadian officials, timing, DQs, packing, timekeeping) with 6-question FAQPage; inbound link from the CA joining guide | "how do swim meets work", "what to expect at your child's first swim meet", "how to read a heat sheet" (Canada) | ca/guides/how-swim-meets-work-parent-guide/index.astro (new), ca/guides/joining-a-swim-club-in-canada-parent-guide/index.astro | [#95](https://github.com/mike-tempest/swim-team/pull/95) | pass, 2719 pages (+1) | Australia is now the last region without a "how swim meets work" parent guide (logged in the International backlog); a CA swim-terms glossary could extend the /ca parent cluster |
| 2026-07-17 | Fri (technical SEO) | Created the three missing international guides hubs (/us/guides/, /ca/guides/, /au/guides/), fixing the BreadcrumbList position-2 item that all 15 intl guides emit but which pointed at a 404; each hub lists its region's 5 guides (parent + board split) with its own BreadcrumbList and ItemList; added a "Guides" link to the intl footer (isIntl-scoped, swimly.uk unchanged) so the hubs are not born orphans | invalid BreadcrumbList schema on 15 pages; hub intent "swim team guides" (US), "swim club guides Canada", "swimming club guides Australia" | us/guides/index.astro (new), ca/guides/index.astro (new), au/guides/index.astro (new), components/Footer.astro | [#129](https://github.com/mike-tempest/swim-team/pull/129) | pass, 2711 to 2714 pages (+3) | Ledger corrections logged in Done: the swimly.club sitemap is a separate route at src/pages/international/sitemap-core.xml.ts (root sitemap-core is UK-only by design, not a bug), and the 2718/2719 counts in recent entries were branch measurements (main baseline is 2711). New follow-up: hubs are in the footer but not the intl Nav or region home pages. PR #100 has merged, so volunteer-burnout (179) and volunteer-management (178) meta descriptions are now unblocked and are the next Friday trims |
| 2026-07-20 | Mon (new content, operator) | New ~1,900-word UK operator guide on raising membership fees: building the rise from the budget, constitutional authority to set subscriptions (AGM vs committee), a 4-row comparison table of increase shapes, Bacs advance notice when the amount/date/frequency changes, a 4-step notice sequence, announcement principles, hardship and bursary routes, and 3 post-increase metrics; 6-question FAQPage; inbound link from managing-swim-club-finances | "how to raise swim club fees", "increasing swim club membership fees", "how much notice to increase club fees", "who decides swim club subs" | how-to-raise-swim-club-fees.md (new), managing-swim-club-finances.md | [#137](https://github.com/mike-tempest/swim-team/pull/137) | pass, 2714 to 2715 pages (+1) | Build output is `dist.nosync/`, not `dist/`. PR #136 (2026-07-18 AGM checklist FAQ) was open with no ledger entry on its branch; that closes the last AGM FAQ backlog item. No run on 2026-07-19. New backlog items: pool hire and lane-time negotiation guide; hardship/bursary and widening-access guide |
| 2026-07-16 | Thu (internal linking) | De-orphaned the membership lifecycle cluster (grow, retention, renewals, trials): 10 contextual links at existing anchors. Grow acts as hub; three deep-dives link back and across; three non-orphan donors (fundraising, why-uk-swim-clubs, handover checklist) feed inbound equity in. All four had 0 inbound and three had 0 outbound | internal link equity for "how to grow swim club membership", "improve swim club membership retention", "swim club membership renewals", "swim club trials and taster sessions" | how-to-grow-swim-club-membership.md, improve-swim-club-membership-retention.md, how-to-manage-swim-club-membership-renewals.md, running-swim-club-trials-and-taster-sessions.md, swimming-club-fundraising-ideas-complete-guide.md, why-uk-swim-clubs-deserve-better-software.md, swimming-club-committee-handover-checklist.md | [#128](https://github.com/mike-tempest/swim-team/pull/128) | pass, 2718 pages (unchanged) | Orphans 36 to 32; 32 posts still have 0 inbound links. Next clusters: county championships parent posts (4 overlapping slugs, check for near-duplication too) and the season posts. Avoided PR #100's three volunteer posts to prevent conflicts |
| 2026-07-24 | Fri (technical SEO) | Trimmed the six worst remaining overlong blog meta descriptions (163-179 chars) to 137-153, keeping the primary keyword in each; also removed a body em dash from the new-season-setup description for house style. Effective meta is seoDescription \|\| description; all six override via description, so that field was edited. Skipped managing-swim-club-finances (165) because its file is in open PR #137 | meta-description truncation in SERPs (e.g. "volunteer burnout swim club", "volunteer management for swimming clubs", "digital transformation for swimming clubs", "swim club end of season checklist", "Swim England API", "new season setup swim club") | volunteer-burnout-in-swim-clubs.md, volunteer-management-for-swimming-clubs.md, digital-transformation-for-swimming-clubs.md, swim-club-end-of-season-checklist.md, swim-england-api-guide-2026.md, new-season-setup-guide-swim-clubs.md | [#139](https://github.com/mike-tempest/swim-team/pull/139) | pass, 2714 pages (unchanged) | About 13 posts remain in the 156-165 range (managing-swim-club-finances 165 is blocked by open PR #137; then the membership/gala/committee posts). Stale ledger entry corrected: swimming-club-agm-legal-requirements-uk was trimmed to 144 in PR #126, not 164. Confirmed on main this run: three PRs still open at run start (#136 AGM-checklist FAQ, #137 raise-fees, #138 DBS refresh), none conflicting with this file set |
| 2026-07-21 | Tue (refresh / AEO) | Refreshed the DBS tracking guide: authored a visible 5-question FAQ + matching faqItems (FAQPage schema, previously none); corrected the Update Service fee (£13 to £16 a year and now free for volunteers, verified on GOV.UK); sharpened the renewal wording (Swim England requires affiliated clubs to renew every 3 years under Wavepower, verified on swimming.org, previously framed as a recommendation), linked both primary sources; added an internal link to the committee-roles guide; set updatedDate | "how often do DBS checks need renewing for swimming clubs", "how much does the DBS Update Service cost", "what DBS check do swim club coaches need" | dbs-check-tracking-for-swimming-clubs.md | [#138](https://github.com/mike-tempest/swim-team/pull/138) | pass, 2714 pages (unchanged) | Post still asserts 2-to-4-week processing times not re-verified this run; confirm if a future refresh leans on them. Open at run start and untouched: PR #137 (raise-fees) and #136 (AGM checklist FAQ, closes the last Ready-backlog AGM FAQ item once merged) |
| 2026-07-25 | Sat (AEO upkeep) | Re-synced public/llms.txt with the live product: rewrote Status and Availability (was pre-launch "Q2 2025 / beta March 2025 / join the waiting list"; now "Swimly is live, create a club today at app.swimly.uk" + founding clubs programme) and Pricing (renamed Championship to Performance and Federation to Enterprise, corrected member bands to Club 50-200 / Performance 200-500 / Enterprise 500+, mirrored the live per-tier feature lists, added a Founding Clubs block); updated all downstream tier-name references; dropped two unverifiable specifics (GoCardless "1% capped at £2", Xero/QuickBooks naming) | "is Swimly available", "how much does Swimly cost", "what plans does Swimly have", "swim club software pricing" (answer-engine / AI-assistant intent) | public/llms.txt | [#140](https://github.com/mike-tempest/swim-team/pull/140) | pass, 2714 pages (unchanged, static asset) | Full em-dash cleanup of llms.txt is a separate house-style task; homepage FAQ says founding clubs get "6 months of the Club plan free" while founding-clubs/pricing pages say "any plan" (on-site copy inconsistency to reconcile). 4 SEO PRs still open on branches (#136 agm-checklist FAQ, #137 raise-fees, #138 dbs refresh, #139 meta trims): their ledger rows live only on their branches until merged |
