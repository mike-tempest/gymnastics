# Forking Swimly for Gymnastics — Build Plan

**Prepared for:** Mike Tempest
**Date:** 4 September 2026
**Approach chosen:** Clean fork · grounded in the `team-swim` codebase · written plan
**Working title for the fork:** _"GymNexus"_ (placeholder — naming exercise flagged below)

---

## 1. Executive summary

The good news the code tells us: **Swimly is roughly three-quarters generic club-management SaaS.** Swimming is not sprayed evenly through the app — it is concentrated in a small number of seams, and one of the seams you'd most fear (governing-body compliance and terminology) has _already been abstracted into configuration_.

Concretely, everything that makes a swim club a swim club lives in **two hard seams and one soft seam**:

- **Soft seam — governing body & compliance (already solved).** A `GoverningBodyConfig` record parameterises registration-number labels, background-check framework (DBS/PVG/etc.), safeguarding framework name, welfare-officer title and data-sharing recipient. It already ships **7 governing bodies across 4 countries**. British Gymnastics becomes a _new entry in that record_, not a code change. The member entity stores the registration number generically (`se_number` + `governing_body`), so a British Gymnastics membership number already fits.
- **Hard seam #1 — naming.** The member entity is called `Swimmer` and the word `swimmer` appears **~3,428 times**. This is wide but mechanical: a scripted rename plus one DB migration.
- **Hard seam #2 — the performance/competitions model.** `Stroke`, `Course`, `CompetitionType` enums, personal-best _times_, gala _times-import_. This is genuinely swimming-only and does **not** transfer — gymnastics scores apparatus with Difficulty + Execution marks against levels/grades, a different data model. This module gets **gutted and rebuilt or deferred**, not reskinned.

So the real build is: **(1)** fork and rebrand, **(2)** rename `swimmer` → a sport-neutral member noun, **(3)** add a British Gymnastics governing-body config, **(4)** replace the times-based competition module — most likely _defer_ it for v1 — and **(5)** add the one net-new module gymnastics clubs actually pay for: **badge / award-scheme progression.** Everything else — auth, families, squads, sessions, attendance, GoCardless billing, invoices, mandates, fee structures, communications, the parent portal, onboarding, waitlists — comes across largely verbatim.

The strategic wedge is different from Swimly's, and better: **gymnastics clubs are drowning in waiting lists and recreational-class admin**, and you already have a `waitlist` module. That is the pain to lead with.

---

## 2. What the codebase actually is (grounded)

**Monorepo** — Turborepo + pnpm workspaces.

| Layer    | Tech                                                                          | Notes                                         |
| -------- | ----------------------------------------------------------------------------- | --------------------------------------------- |
| Frontend | Next.js 14 (App Router, RSC), TypeScript, Tailwind, shadcn/ui, TanStack Query | `apps/web` — ~297 source files                |
| Backend  | NestJS (modular monolith styled as microservices), TypeORM                    | `services/membership` — ~400 source files     |
| Data     | PostgreSQL 16, Redis 7                                                        | TypeORM entities + migrations in-repo         |
| Gateway  | Kong                                                                          | API management                                |
| Billing  | **GoCardless** (Direct Debit, primary) + **Stripe** (cards, secondary)        | dedicated `gocardless` + `finance` modules    |
| Shared   | `packages/shared-types`, `packages/utils`                                     | **enums + `GOVERNING_BODY_CONFIG` live here** |
| Infra    | Docker Compose, **Railway** (prod), Turborepo pipeline                        | single deploy target today                    |

**Backend domain modules** (`services/membership/src/modules`):
`activation, admin, attendance, auth, clubs, communications, competitions, compliance, data-import, email, families, finance, gocardless, health, parent, sessions, squads, swimmers, users, waitlist, wellbeing`

**Frontend route groups** (`apps/web/src/app`):
`admin, attendance, billing, communications, competitions, compliance, dashboard, families, fee-structures, invoices, mandates, onboarding, parent, payments, sessions, squads, swimmers`

**Cross-cutting foundations already present** (these are what make a clean fork cheap):

- `common/tenancy` — tenant context service + interceptor + tenant-scoped query helper (multi-club isolation is real and tested — there are `*.tenant-isolation.spec.ts` files).
- `common/region` — governing-body config, formatting, country defaults.
- A separate `marketing-site` (its own Next.js app) — reskinned independently of the product.

---

## 3. Where swimming actually lives — the seams and the effort

Evidence from the code, by disposition:

| Disposition                          | What                                                                                                                                                                                                                              | Evidence                                                                                                                                                                                                                                                         | Effort                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Transfers ~verbatim**              | auth, users, clubs, families, squads, sessions, attendance, finance/gocardless/mandates/invoices/fee-structures, communications/email, parent portal, activation/invite/onboarding, waitlist, admin, data-import, health, tenancy | Generic entities; `Swimmer` itself is just name/dob/gender/family/squad/club + medical + emergency contact                                                                                                                                                       | Low — copy across                                               |
| **Config swap (already abstracted)** | compliance + all NGB terminology                                                                                                                                                                                                  | `GoverningBodyConfig` interface with `safeguardingFramework`, `backgroundCheckFramework`, `safeguardingOfficerLabel`, `registrationNumberLabel`, `dataSharingRecipient`; consumed by `compliance/consents`, `compliance/dbs`, `compliance/safeguarding`, `email` | Low — add a `BRITISH_GYMNASTICS` entry                          |
| **Rename surface**                   | `Swimmer` entity, `swimmers` table, `/swimmers` routes, `swimmer_id` FKs, components, 3,428 string refs                                                                                                                           | `grep swimmer` = 3,428; `@Entity('swimmers')`                                                                                                                                                                                                                    | Medium — scripted rename + migration; wide but shallow          |
| **Gut & rebuild (or defer)**         | competitions/performance                                                                                                                                                                                                          | `Stroke`/`Course`/`CompetitionType` enums; `personal-bests.service`, `times-import.service`, gala `file-import` — all time/stroke shaped (741 `stroke` refs)                                                                                                     | High — different domain model; strong candidate to defer for v1 |
| **Net-new**                          | badge / award-scheme progression; recreational level structure                                                                                                                                                                    | No awards/badges module found today                                                                                                                                                                                                                              | Medium — the "little more functionality" you flagged            |

The headline: the two big scary numbers (3,428 `swimmer` refs, 741 `stroke` refs) are **one mechanical rename** and **one module you were going to replace anyway**. Neither is architecturally deep.

---

## 4. The clean-fork mechanics

You chose a clean fork — a standalone product that can diverge freely. Here's the setup, and one discipline to protect you from the fork's main downside.

**Standing it up:**

1. **New repo** (e.g. `github.com/<org>/gym-nexus`) seeded from a `team-swim` snapshot. Fork, don't submodule — you want freedom.
2. **Rename the package scope** `@swim-nexus/*` → `@gym-nexus/*` across `packages/*` and imports (single find-replace + `pnpm-workspace` update).
3. **Rebrand pass** — ~30 web-src files reference the `Swimly` literal, plus `tailwind.config.ts` + `design-system/`. Centralise remaining brand strings into one config while you're in there.
4. **The member rename** — `Swimmer` → a sport-neutral noun. **Recommendation: `Member` (or `Gymnast`).** `Member` future-proofs any later sport; `Gymnast` reads better in-product. Do it as a codemod (ts-morph / scripted) + a single TypeORM migration renaming the `swimmers` table and FKs. One PR, reviewed carefully, tested against the tenant-isolation specs.
5. **Add British Gymnastics** to `GOVERNING_BODY_CONFIG` (see §5).
6. **Competitions decision** (see §6) — for v1, feature-flag the times-based competitions module _off_ rather than deleting it, so the walking skeleton stays green.
7. **New infra** — separate Railway project, separate Postgres, separate Redis, separate GoCardless creditor/account, new domain + subdomains, fresh `.env`. Nothing shared with Swimly prod.

**The one discipline that saves you later:** a clean fork's cost is _divergence_ — a bug you fix in Swimly's GoCardless flow you now fix twice. Mitigate cheaply by keeping the **generic core mergeable**: don't gratuitously reformat or restructure `packages/shared-types`, `packages/utils`, `gocardless`, `finance`, `auth`, `tenancy` in the fork. Keep them close enough that you can `git cherry-pick` or diff-apply fixes across the two repos for the first year. You get fork freedom where it matters (domain, brand, UX) and shared-core hygiene where it's just plumbing. This is 90% of the platform benefit at 10% of the platform cost — and leaves the door open to _properly_ converge into a multi-sport platform later if gymnastics proves out.

---

## 5. Gymnastics domain specifics

**Governing body — British Gymnastics (BG).** Clubs affiliate with BG; participants and coaches hold BG membership. The home-nation safeguarding split you already model for swimming applies identically: **DBS** in England & Wales, **PVG** in Scotland, **AccessNI** in Northern Ireland — the exact axis `GoverningBodyConfig` already encodes. The new config entry looks like:

```
[GoverningBody.BRITISH_GYMNASTICS]: {
  label: 'British Gymnastics',
  country: 'GB',
  registrationNumberLabel: 'BG membership number',
  backgroundCheckFramework: 'DBS',
  backgroundCheckShortLabel: 'DBS',
  certificateNumberLabel: 'Certificate number',
  backgroundCheckTypes: DBS_CHECK_TYPES,
  safeguardingFramework: '<BG safeguarding policy name — verify>',
  safeguardingOfficerLabel: 'Club Welfare Officer',
  dataSharingRecipient: 'British Gymnastics',
}
```

> **Verify before build (NGB specifics change):** exact current name of BG's safeguarding policy/framework (their equivalent of Wavepower), BG membership categories/tiers and fees, coach-qualification levels, and whether BG mandates specific data-handling wording. Treat the placeholders above as to-confirm against current British Gymnastics documentation, not as settled facts.

**Disciplines.** Gymnastics is multi-discipline in a way swimming isn't: Women's Artistic (WAG), Men's Artistic (MAG), Trampoline, Tumbling, Double-Mini, Acrobatic, Rhythmic, TeamGym, Aerobic, Freestyle/Parkour, plus large **recreational**, **pre-school** and **adult** cohorts. Model _discipline_ as an attribute on squad/class and on the member's registration — it drives filtering, not separate code paths.

**Recreational vs competitive pathway.** Unlike a swim club (mostly squads), a gym club is a **wide recreational base + a narrow competitive squad pathway**. Your `squads` module already models grouped training; extend it (or add a light `classes`/`levels` concept) so recreational badge classes and competitive squads coexist. This mostly reuses squads + sessions + attendance.

**Badge / award schemes — the net-new module and a revenue line.** British Gymnastics proficiency/award schemes are central to how rec gymnastics runs: gymnasts progress through award levels, get assessed, and clubs charge **badge + certificate fees**. There is no awards module in Swimly today, so this is genuinely new — but it's a contained module: `award scheme → levels → per-member progress → assessment event → badge fee (bill via existing finance/GoCardless)`. This _is_ the "reskin plus a little more functionality" instinct, and it's the feature that makes the product feel gymnastics-native rather than a repainted swim app.

**Competition scoring (if/when you build it).** Apparatus-based: per-apparatus Difficulty (D) + Execution (E) → apparatus score → all-around; against BG grades/levels (and FIG at elite). This replaces `Stroke`/`times` entirely. See §6 — recommend deferring.

**The wedge — waiting lists.** UK gym clubs are notorious for long waiting lists and recreational-class churn admin. You already ship a `waitlist` module. Lead the product and the GTM with _waitlist-to-enrolment-to-Direct-Debit_ as the hero flow; it's a sharper pain than anything in swimming and a clean differentiator against class-booking incumbents.

**Competitive landscape (positioning input).** UK gymnastics club software is led by class-booking-first tools — **ClassForKids** is the incumbent to know, with others (Love Admin / Class Manager-style tools, Coacha, and US players like iClassPro/Jackrabbit) around it. Their centre of gravity is _class booking + card payments_. Your inherited edge is the opposite end: **compliance-grade safeguarding/DBS tracking, squad/level progression, family-based memberships with sibling discounts, and Direct-Debit-first billing.** Position as "the club-operations and compliance platform" not "another class-booking widget." Verify the current incumbent set and pricing during Phase 0.

---

## 6. The competitions decision (make this explicitly)

This is the one place you must decide, not drift:

- **Option A — Defer (recommended for v1).** Feature-flag competitions off. Rec gymnastics clubs' acute pain is waitlists, registers, badges and billing — not results management. Ship faster, learn, then build scoring against real club demand.
- **Option B — Rebuild now.** Replace strokes/times with apparatus + D/E + grades. Meaningful build; only worth it if your founding clubs are competitive-squad-heavy and name results as a must-have.

Recommendation: **A.** Keep the module in the tree behind a flag (don't delete — you may want a gymnastics scoring module later, and the entry points/UX scaffolding are reusable even if the internals aren't).

---

## 7. Module-by-module disposition

| Module                                                            |   Keep    |                    Reskin                     |  Rebuild   |    New     |
| ----------------------------------------------------------------- | :-------: | :-------------------------------------------: | :--------: | :--------: |
| auth, users, clubs, tenancy                                       |    ✅     |                                               |            |            |
| families (sibling discounts)                                      |    ✅     |                                               |            |            |
| squads → squads + rec levels                                      |           |                      ✅                       |            |            |
| sessions, attendance                                              |    ✅     |                                               |            |            |
| finance, gocardless, invoices, mandates, fee-structures, payments |    ✅     |                                               |            |            |
| communications, email                                             |    ✅     |                    (brand)                    |            |            |
| parent portal                                                     |           |                      ✅                       |            |            |
| onboarding, activation, invite                                    |           |                      ✅                       |            |            |
| waitlist                                                          | ✅ (hero) |                                               |            |            |
| compliance (+ NGB terminology)                                    |           |                   ✅ config                   |            |            |
| data-import                                                       |           | ✅ (map from ClassForKids/Love Admin exports) |            |            |
| competitions (times/strokes)                                      |           |                                               | ✅ / defer |            |
| **award / badge schemes**                                         |           |                                               |            |     ✅     |
| **discipline model on squad/member**                              |           |                                               |            | ✅ (light) |
| admin, health, wellbeing                                          |    ✅     |                                               |            |            |

---

## 8. Phased roadmap

Effort is framed as calendar phases with relative size rather than false-precision day counts (you build heavily with AI agents, so absolute estimates would mislead). Verify-items from §5 land in Phase 0.

**Phase 0 — Validate & scope (short).**
Confirm the wedge with 3–5 target gym clubs; verify BG NGB specifics (safeguarding framework name, membership tiers, badge schemes); confirm incumbent set + pricing; lock naming/brand and the member noun; decide competitions A vs B. _Exit: signed-off scope + a founding-club shortlist._

**Phase 1 — Walking skeleton (fork + rename + rebrand + BG config).**
New repo/infra; scope + brand rename; `Swimmer` → `Member/Gymnast` codemod + migration; add British Gymnastics to `GOVERNING_BODY_CONFIG`; competitions flagged off; green build deployed to a new Railway project with a demo club. _Exit: a working, gymnastics-branded, BG-compliant club-management app with billing, families, squads, sessions, attendance, waitlist, parent portal._

**Phase 2 — Gymnastics-native (badges + levels + discipline).**
Build the award/badge-scheme module (progress + assessment + badge-fee billing via existing finance); add recreational level structure on squads; add discipline attribute + filtering. _Exit: product feels gymnastics-native, not a repainted swim app._

**Phase 3 — Wedge polish + migration on-ramp.**
Harden waitlist→enrolment→Direct-Debit as the hero flow; build/verify `data-import` mappers from the incumbents' CSV/exports (the switching cost is the moat-breaker). _Exit: a club can self-migrate in an afternoon._

**Phase 4 — Founding clubs & GTM.**
Reskin `marketing-site`; founding-club programme mirroring Swimly's waitlist play; onboard first cohort; instrument and iterate.

---

## 9. Pricing & positioning (starting point)

Mirror Swimly's model and adjust for gymnastics' shape:

- Gym clubs have **larger recreational cohorts** than swim squads → per-member pricing scales up; consider tiered/banded pricing so large rec clubs aren't penalised.
- **Badge/award fees** are a club revenue line you help administer → a natural place for a small transaction margin or a premium tier.
- Lead value prop: _"Compliance-grade club operations with Direct-Debit billing and waitlist-to-enrolment built in — not just class booking."_
- Keep GoCardless-first billing as a **differentiator** vs card-first incumbents (lower fees on recurring memberships is a real club saving — quantify it in sales).

---

## 10. Key risks & decisions to close

1. **Naming/brand** — needs deciding early (blocks Phase 1 rename). Happy to run a naming exercise. _Decision: yours._
2. **Member noun** — `Member` (future-proof) vs `Gymnast` (reads native). Recommend `Member` if you might add a third sport, else `Gymnast`. _Decision: yours._
3. **Competitions A vs B** — recommend defer (A). _Decision: yours._
4. **Fork divergence** — real ongoing cost; mitigated by the shared-core-hygiene discipline in §4. _Accept + adopt discipline._
5. **NGB accuracy** — BG specifics must be verified against current docs before compliance copy ships; getting safeguarding wording wrong is a trust-killer with clubs. _Verify in Phase 0._
6. **Incumbent switching costs** — clubs are locked into ClassForKids et al.; the `data-import` mappers (Phase 3) are what make switching feasible. Under-invest here and the wedge stalls.

---

## 11. Immediate next steps

- **You decide:** brand/name · member noun · competitions A vs B.
- **Phase 0 kickoff:** I can produce (a) the British Gymnastics compliance/NGB verification brief, (b) a target founding-club shortlist, and (c) the exact codemod + migration spec for the `Swimmer → Member` rename, ready to hand to a build agent.
- **First code task (when you're ready):** stand up the fork skeleton — new repo from a `team-swim` snapshot, scope rename, brand centralisation, and the `BRITISH_GYMNASTICS` config entry — as the Phase 1 walking skeleton.

_Every code reference in this plan (module inventory, the `GoverningBodyConfig` seam, `Swimmer`/stroke counts, the tenancy/region foundations) is taken from the current `~/GitHub/team-swim` working tree._
