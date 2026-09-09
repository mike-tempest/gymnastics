# Gymnastics Fork — Execution Plan (What To Do Next)

**Prepared for:** Mike Tempest · **Date:** 4 September 2026
**Companion to:** _Forking Swimly for Gymnastics — Build Plan_

**Working assumptions** (change any and I'll re-cut the plan):

- Member noun = **`Member`** · Competitions = **deferred for v1** · Brand = **placeholder** (`GymNexus`) until decided.

---

## The critical path (read this first)

Only one chain of work actually gates the launch. Everything else runs alongside it.

> **3 decisions → fork + rename + BG config (walking skeleton) → badge/award module → migration on-ramp → founding clubs live.**

NGB verification, brand/name, and founding-club recruitment all run **in parallel** and only need to _land_ before the phase that consumes them. If a task isn't on that chain, it can slip without moving the launch date. Guard the chain; be relaxed about the rest.

**Owner legend:**
`[You]` = your decision/relationship · `[Prep]` = I produce it (spec/brief/research) · `[Build]` = agent-executable engineering task.

---

## Phase 0 — Decide & de-risk _(this week — ~3–5 days)_

**Goal:** remove every unknown that would force rework later. Nothing here is code; it's the stuff that's expensive to get wrong once building starts.

| Task                                                                                                                                                                             | Owner              | Done when                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------- |
| Lock the 3 decisions (name, member noun, competitions)                                                                                                                           | `[You]`            | Written down; unblocks the rename                                                              |
| British Gymnastics compliance verification brief — exact safeguarding-policy name, membership tiers/categories, coach-qual levels, DBS/PVG/AccessNI split, data-handling wording | `[Prep]`           | Verified against current BG docs; ready to drop into `GOVERNING_BODY_CONFIG` + compliance copy |
| Confirm incumbent landscape + pricing (ClassForKids et al.) and the migration-export formats they let clubs download                                                             | `[Prep]`           | Know what we import from in Phase 3, and how we price against them                             |
| Founding-club shortlist — 5–8 target gym clubs, waitlist-pain profile, warm intro paths                                                                                          | `[Prep]` + `[You]` | Shortlist with contact routes                                                                  |
| `Swimmer → Member` codemod + migration spec (ts-morph transforms, table/FK rename, route + component + type changes, test surfaces)                                              | `[Prep]`           | Spec an agent can execute in one pass                                                          |

**Exit gate:** decisions locked · BG facts verified · rename spec ready · founding-club shortlist in hand.

---

## Phase 1 — Fork skeleton _(walking skeleton — the big one)_

**Goal:** a working, gymnastics-branded, BG-compliant club-management app deployed to its own infra, with the generic core intact and competitions flagged off. This is the phase that proves the fork thesis.

| Task                                                                                                   | Owner                          | Done when                                                                                     |
| ------------------------------------------------------------------------------------------------------ | ------------------------------ | --------------------------------------------------------------------------------------------- |
| Snapshot `team-swim` → new repo; strip Swimly marketing/content/report dirs                            | `[Build]`                      | Clean fork repo, product code only                                                            |
| Rename pnpm scope `@swim-nexus/*` → new scope; fix workspace + imports                                 | `[Build]`                      | `pnpm i` + build green                                                                        |
| Centralise remaining brand strings (~30 files) into one brand config; swap Tailwind/design tokens      | `[Build]`                      | No hard-coded "Swimly" in product                                                             |
| Execute `Swimmer → Member` codemod + TypeORM migration                                                 | `[Build]`                      | Tests + tenant-isolation specs green                                                          |
| Add `BRITISH_GYMNASTICS` to `GoverningBody` enum, labels, country default, and `GOVERNING_BODY_CONFIG` | `[Build]`                      | Compliance/DBS/consent surfaces render BG wording                                             |
| Feature-flag the times/strokes competitions module **off**                                             | `[Build]`                      | App builds without it; module retained in tree                                                |
| New infra — Railway project, Postgres, Redis, GoCardless creditor (sandbox), domain/subdomains, `.env` | `[Build]` + `[You]` (accounts) | Deployed, reachable                                                                           |
| Seed a gymnastics demo club + smoke-test hero flows                                                    | `[Build]`                      | Create member → family → squad → session → attendance → mandate → invoice → waitlist all pass |

**Exit gate:** demo gym club runs end-to-end on new infra; billing, families, squads, sessions, attendance, waitlist, parent portal all working under gymnastics branding + BG compliance.

---

## Phase 2 — Make it gymnastics-native

**Goal:** stop looking like a repainted swim app. Add the things a gym club expects and that competitions' absence would otherwise expose.

| Task                                                                                                                                                                  | Owner     | Done when                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------- |
| **Badge / award-scheme module** — schema (`scheme → level → per-member progress → assessment event → badge fee`), admin UI, bill fees via existing finance/GoCardless | `[Build]` | Coach can assess, award, and charge a badge fee end-to-end |
| Recreational level structure on `squads` (rec classes vs competitive squads coexist)                                                                                  | `[Build]` | Both cohort types model cleanly                            |
| `discipline` attribute on member/squad (WAG/MAG/Tramp/Rec/etc.) + filtering                                                                                           | `[Build]` | Filter/report by discipline                                |
| Parent portal: surface badge progress                                                                                                                                 | `[Build]` | Parents see their child's award progression                |

**Exit gate:** a founding club could run its recreational programme — classes, registers, badges, billing — with no swimming residue.

---

## Phase 3 — Wedge polish + migration on-ramp

**Goal:** make the pain-killer sharp and make switching trivial (the real moat-breaker vs incumbents).

| Task                                                            | Owner     | Done when                                        |
| --------------------------------------------------------------- | --------- | ------------------------------------------------ |
| Harden **waitlist → enrolment → Direct Debit** as the hero flow | `[Build]` | One-click from waitlist to active, billed member |
| Data-import mappers from ClassForKids / Love Admin exports      | `[Build]` | A club's export maps into the app                |
| Self-serve migration wizard                                     | `[Build]` | A club migrates in an afternoon                  |

**Exit gate:** a new club can self-onboard from their old tool without hand-holding.

---

## Phase 4 — Founding clubs & GTM

**Goal:** first real clubs on, learning loop running.

| Task                                                    | Owner               | Done when                        |
| ------------------------------------------------------- | ------------------- | -------------------------------- |
| Reskin `marketing-site` for gymnastics                  | `[Build]`           | Live gymnastics marketing site   |
| Founding-club programme (mirror Swimly's waitlist play) | `[You]` + `[Prep]`  | Offer + landing + waitlist live  |
| Onboard first cohort; instrument; iterate               | `[You]` + `[Build]` | Clubs active; usage instrumented |

**Exit gate:** paying/committed founding clubs using it weekly.

---

## What runs in parallel vs in series

- **Series (the critical path):** Phase 0 decisions → Phase 1 skeleton → Phase 2 badges → Phase 3 migration → Phase 4 clubs.
- **Parallel, feeding a later gate:** BG verification (feeds Phase 1 compliance copy) · brand/name (feeds Phase 1 rename) · founding-club recruitment (starts Phase 0, lands Phase 4) · incumbent/export research (feeds Phase 3 importers).
- **Deferred, off the path:** competitions/scoring rebuild — only if founding clubs are competitive-squad-heavy and demand it.

---

## Your next 3 actions

1. **`[You]` — make the 3 calls** (or accept the defaults at the top). ~15 minutes. This is the only thing blocking everything else.
2. **`[Prep]` — I produce the Phase 0 pack:** BG compliance verification brief · founding-club shortlist · the exact `Swimmer → Member` codemod + migration spec, ready to hand to a build agent.
3. **`[Build]` — kick the fork skeleton** (Phase 1 tasks 1–3: snapshot → scope rename → brand centralisation) the moment a name is set.

_Say the word and I'll start on action 2 now — none of it needs the brand decision._
