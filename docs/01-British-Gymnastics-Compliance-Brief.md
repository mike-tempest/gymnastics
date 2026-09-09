# British Gymnastics — Compliance & NGB Verification Brief

_Prepared 4 September 2026 for a UK gymnastics club-management SaaS (forked from a swim-club platform). British Gymnastics (BG) is the UK National Governing Body (NGB) for gymnastics. Items marked **[verify at build time]** are date-sensitive (fees, tier names, scheme names) and should be re-confirmed against british-gymnastics.org before launch. Where a fact could not be fully verified from primary sources, it is flagged **[unverified]**._

---

## 1. Club affiliation & individual membership

**Club affiliation.** Clubs join BG as **registered clubs**. Per BG's Membership Rules (v13.0, July 2025), a registered club must:

- affiliate to its Home Country Association (English / Scottish / Welsh / Northern Ireland Gymnastics) and, where applicable, to no more than one affiliated Regional Association;
- maintain a minimum membership (the Rules state **at least 10 gymnast members**);
- appoint a qualified **head coach**, a **club secretary/manager**, and a **Welfare Officer**;
- ensure members hold appropriate criminal-record checks and safeguarding training.
- It is a **condition of club registration that all club members also hold individual BG membership** (confirmed by BG-aligned club privacy notices).

**Individual membership categories** (from Membership Rules v13.0 — **[verify at build time]**, as BG has been running a "membership modernisation" programme and consumer-facing tier names may differ):

_Participant/gymnast side:_

- **Community Membership** — recreational / non-competitive gymnasts of any age; also judges, welfare officers, admin roles.
- **Competitive Membership** — those competing in events organised by registered clubs (not by BG directly).
- **National Membership** — those competing in BG-organised or Home Country Association competitions.

_Coach side:_

- **Enhanced Membership** — UKCC Level 2+ coaches, Activity Instructors, Honorary Life members, certain committee roles.
- **National Membership (coach)** — UKCC Level 1 Assistant Coaches and those in the international-qualification transfer process.

**Fees.** The Rules state only that "the cost of the annual fee is set each year by the Board." No specific fee figures are published on the pages reviewed — **[verify at build time]** against the live membership pages.

---

## 2. Registration / membership number

BG calls a member's identifier their **"membership number."** BG's own "How to log in to My BG" guide instructs members to log in with their "membership number/username and password." (The self-service member portal is branded **My BG**.)

**Recommended `registrationNumberLabel` value: "BG membership number"** (or simply "Membership number"). Note: an informal shorthand "BG number" appears in community usage but "membership number" is the term BG uses in its own documentation.

**Format: no published format** (checked September 2026 against british-gymnastics.org, BG's "How do I log in to My BG?" guide and the My BG portal). BG documents the number only as a login identifier that doubles as a My BG username; no length, digit count or character set is published anywhere in BG's primary sources, and members who do not know their number are told to retrieve it from BG emails. **Do not apply the Swim England 7-digit format (or zero-padding) to BG numbers.** The platform validates BG membership numbers as non-empty, at most 20 characters (`BRITISH_GYMNASTICS` is excluded from `UK_GOVERNING_BODIES`, which gates the strict 7-digit import check). Tighten only if BG ever publishes a format.

---

## 3. Safeguarding framework

BG does **not** use a single branded product name equivalent to Swim England's "Wavepower." Instead:

- The core policy is the **"Safeguarding and Protecting Children Policy"** (also referenced as the BG Safeguarding and Protecting Policy), sitting alongside related documents (Child Protection/incident reporting forms, Criminal Record Checks policy, and a wider "Safeguarding and Compliance" set of policies).
- BG's umbrella programme/section for this work is branded **"Safe & Fair Sport"** — the team and web section responsible for safeguarding across the sport and for handling complaints and concerns. Treat "Safe & Fair Sport" as the closest thing to a named suite, with the "Safeguarding and Protecting Children Policy" as the governing policy document. **[verify at build time]** — confirm current policy title/version on the live Safe & Fair Sport pages.

**Club-level role title: "Welfare Officer."** BG requires every registered club (and region/event) to have a **nominated Welfare Officer** responsible for responding to child-protection and poor-practice concerns and supporting welfare procedures. (This is BG's equivalent of a Club Welfare / Safeguarding Officer; "Welfare Officer" is the term to use.)

_Context note (not for config):_ BG's safeguarding regime was overhauled following the independent **Whyte Review (2022)** into abuse in the sport — relevant if you write explanatory compliance copy.

---

## 4. Background checks by UK home nation

Confirmed that the standard UK home-nation schemes apply to BG coaches/volunteers in regulated roles:

- **England & Wales — DBS** (Disclosure and Barring Service).
- **Scotland — PVG** (Protecting Vulnerable Groups scheme, via Disclosure Scotland). _Note:_ one BG Club Hub resource page phrased checks as "DBS" for England/Wales/Scotland and "AccessNI" for Northern Ireland and did **not** explicitly name PVG — **[verify at build time]**. PVG is the correct statutory scheme for Scotland and is used by Scottish Gymnastics, so your config should model DBS / PVG / AccessNI by nation, but confirm BG's exact wording for Scotland.
- **Northern Ireland — AccessNI**.

**BG-specific process/terminology:** BG administers criminal-record checks through its own process (checks are arranged/verified via BG rather than the club acting alone), commonly referred to in BG materials as a **"criminal record check."** No distinctly branded BG vetting-portal name was found in the sources reviewed — **[unverified]**; if you need a portal name, verify directly with BG. Checks are managed within the **My BG** membership system. **[verify at build time]**

---

## 5. Coaching qualifications

BG uses a **tiered, discipline-specific coaching pathway**. The framework (confirmed via BG Club Hub and the Scottish Gymnastics course pages, which mirror the BG/UKCC structure) is broadly:

- **Assistant (Foundation) Coach** — entry, works under supervision; "Foundations of Gymnastics Coaching" + "Delivering Gymnastics Activities."
- **Foundation Coach** — 18+, leads sessions independently after assessment.
- **Gymnastics Activity Instructor** — can independently deliver activity sessions; add-on discipline modules available.
- **Level 1 Coach** — discipline-specific entry qualification; coaches under indirect supervision of a more qualified coach.
- **Level 2 Coach** — discipline-specific; can plan and lead sessions independently (Level 1 prerequisite).
- **Level 3 Coach** — advanced (coaching theory + discipline technical/development practical).
- **Level 4 Coach** — Senior Club Coach / Performance Coach (application-based).
- **Level 5 Coach** — High-Performance Coach (highest tier).

_Note:_ BG has historically used **UKCC (UK Coaching Certificate) Level 1–4** labels; newer branding uses "Assistant/Foundation Coach" plus numbered levels. Both appear in current materials, so **[verify at build time]** whether your config should present "UKCC Level 1/2" or the newer names — and note exact level availability varies by discipline.

---

## 6. Data sharing / GDPR

- **Membership condition:** "It is a condition of British Gymnastics club registration that all our club members also register as individual members of British Gymnastics." (standard BG-aligned club wording).
- **Lawful basis for sharing with BG:** clubs rely on **legitimate interest** — e.g. "We have a legitimate interest in sharing your personal information with British Gymnastics to ensure the sport is safe and well-governed and where relevant to access support and advice."
- **Controller structure:** the **club is the data controller** for its own members' data; it **shares member data with BG** for registration, governance and safeguarding. BG publishes its own **Privacy Notice** (a BG Club Hub "Privacy Notice" exists) governing BG's use of that data. Whether BG is a separate or joint controller once data is received is **not explicitly stated** in the club notices reviewed — **[unverified]**; if your copy needs to assert BG's controller status, confirm against BG's own Privacy Notice.
- **Design implication:** the platform should support pushing member registration data to BG and should reference BG's Privacy Notice in club-facing consent/privacy copy. Do not hardcode specific retention periods or lawful-basis wording without confirming BG's current Privacy Notice — **[verify at build time]**.

---

## 7. Disciplines

Official BG gymnastics disciplines (confirmed set — **10 core competitive disciplines**):

1. Women's Artistic Gymnastics (WAG)
2. Men's Artistic Gymnastics (MAG)
3. Rhythmic Gymnastics
4. Trampoline
5. Double Mini Trampoline (DMT)
6. Tumbling
7. Acrobatic Gymnastics
8. TeamGym
9. Aerobic Gymnastics
10. Disability Gymnastics

**Notes / caveats:**

- Trampoline, DMT and Tumbling are sometimes grouped under a **"Trampoline & DMT / Gymnastics for All"** banner but are distinct disciplines.
- **Pre-school** and **adult** gymnastics, and **Freestyle / Parkour (FreeG)**, are BG **participation programmes/pathways** rather than always being listed among the 10 core competitive disciplines. Parkour/Freestyle ("FreeG") has been offered by BG but its status as a listed "discipline" is inconsistent across BG pages — **[verify at build time]** if you intend to list it as a formal discipline.
- **GymFusion** is a BG **non-competitive performance/festival programme**, not a discipline.
- Recommend modelling disciplines as configurable data, with the 10 above as the confirmed core set and pre-school/adult/parkour as separate "programme" flags.

---

## 8. Award / badge schemes

BG's recreational proficiency/award scheme has been **rebranded to "Rise Gymnastics"** (the **Rise Awards**), which replaces the long-standing **Proficiency Awards / Core Proficiency badge scheme** (formerly "BAGA awards"). BG publishes migration guidance ("How do gymnasts transfer from Proficiency Awards to Rise?"), confirming Rise is the current scheme. **[verify at build time]** — this is a live transition; some clubs may still run legacy Proficiency Awards.

**Rise structure** (skill/competency-based, delivered by clubs):

- **Rise Discover** — pre-school; ~12 themed units; award on completing e.g. 12 of 16 skills.
- **Rise Explore** — school-aged recreational; strands (Core Skills, Apparatus, Working Together), four levels each; award on e.g. 8 of 12 skills.
- **Rise Excel** — advanced recreational; four strands, three levels; thresholds vary (e.g. 10 of 14 / 7 of 10 skills).

**How it works:** coaches assess gymnasts against skill criteria within their sessions (competency-based, not a fixed exam); parents are notified when a level is passed. **Medals/badges and certificates are awarded**, and clubs typically **purchase badges/certificates and may charge families for them** — badge/certificate fees are a common club revenue line, so the platform should support per-award badge charges. **[verify at build time]** — exact level names, skill counts and any BG badge pricing are subject to change during the Rise rollout.

---

## Unverified / flag summary

- Exact **current consumer-facing membership tier names & fees** — [verify at build time].
- **Scotland check wording** (PVG vs BG's "DBS" phrasing) — [verify]; PVG is correct statutory scheme.
- Named **BG vetting portal** — [unverified]; checks run via My BG / BG criminal-record-check process.
- BG's **controller status** once data is shared — [unverified].
- **Parkour/Freestyle (FreeG)** and pre-school/adult as formal "disciplines" vs programmes — [verify].
- **Rise** scheme details and any legacy Proficiency Awards still in use — [verify]; live transition.
- Whether BG uses **UKCC** vs newer coach-level branding in current materials — [verify].

## Proposed `GOVERNING_BODY_CONFIG` entry (from the above)

```ts
[GoverningBody.BRITISH_GYMNASTICS]: {
  label: 'British Gymnastics',
  country: 'GB',
  registrationNumberLabel: 'BG membership number',
  backgroundCheckFramework: 'DBS',          // England & Wales; PVG (Scotland) / AccessNI (NI) by nation
  backgroundCheckShortLabel: 'DBS',
  certificateNumberLabel: 'Certificate number',
  backgroundCheckTypes: DBS_CHECK_TYPES,
  safeguardingFramework: 'Safeguarding and Protecting Children Policy', // under BG "Safe & Fair Sport" — no Wavepower-style brand
  safeguardingOfficerLabel: 'Welfare Officer',
  dataSharingRecipient: 'British Gymnastics',
},
```

_Award scheme for the badges module: **Rise** (Discover / Explore / Excel), replacing legacy Proficiency Awards; support per-award badge/certificate charges._

## Sources

- [BG Memberships](https://www.british-gymnastics.org/memberships) and [About your Club Membership](https://www.british-gymnastics.org/about-your-club-membership)
- [BG Membership Rules v13.0, July 2025 (PDF)](https://a.storyblok.com/f/83342/x/8507cce2d6/2025_07_11_membership_rules_v13-0_live.pdf)
- [BG "How to log in to My BG" (PDF)](https://a.storyblok.com/f/83342/x/33e63667d4/how-to-login-to-mybg-v3.pdf)
- [BG Safe & Fair Sport / Safeguarding](https://www.british-gymnastics.org/safesport/safeguarding) and [Safeguarding & Compliance course policies](https://www.british-gymnastics.org/coaching/coaches/course-policies/777-safeguarding-and-compliance)
- [BG article: Safe and Fair Sport — Safeguarding in Gymnastics](https://www.british-gymnastics.org/articles/safe-sport/safe-and-fair-sport-safeguarding-in-gymnastics)
- [BG Club Hub: criminal record check resources](https://clubhub-resources.british-gymnastics.org/lesson-tag/criminal-record-check/)
- [BG Club Hub: The role of the Level 1 Coach](https://clubhub-resources.british-gymnastics.org/courses/people-development/lessons/the-role-of-the-level-1-coach/) and [Scottish Gymnastics Formal Courses](https://www.scottishgymnastics.org/people/coaching-instructing/formal-courses/)
- [Wikipedia: British Gymnastics](https://en.wikipedia.org/wiki/British_Gymnastics) (disciplines cross-check)
- [BG article: Rise Gymnastics is here](https://www.british-gymnastics.org/articles/rise-gymnastics/rise-gymnastics-is-here), [Transfer from Proficiency Awards to Rise](https://www.british-gymnastics.org/articles/rise-gymnastics/how-do-gymnasts-transfer-from-proficiency-awards-to-rise), and [Dronfield Gymnastics — Rise Awards](https://dronfieldgymnasticsacademy.co.uk/bg-proficiency-awards/)
- [BG Club Hub Privacy Notice](https://clubhub-resources.british-gymnastics.org/privacy-notice/) and [Celebrate Gymnastics Club Privacy Policy](https://celebrategymnasticsclub.com/privacy-policy/)
