# CLAUDE.md - Gymnastics Platform Monorepo

## Project Overview
This is a **clean fork of Swimly** (`team-swim`) into a standalone club-management platform for **British Gymnastics-affiliated clubs**. Product name is not yet decided (Linear TEM-5); until it is, refer to it as "the gymnastics platform" and do not invent a brand name in code or copy.

The fork thesis: Swimly is ~75% generic club-management SaaS. Swimming lives in three seams, and this fork removes them:
1. **Governing body / compliance** is already config-driven (`GOVERNING_BODY_CONFIG` in `packages/shared-types`). British Gymnastics is a config entry, not a rewrite.
2. **The `Swimmer` entity** is renamed to `Member` (see Naming below).
3. **The times/strokes competitions module** is swimming-only and is **feature-flagged off**, not deleted.

Planning and specs live in `docs/` (see Reference Docs). Work is tracked in Linear project **Gymnastics** (team `TEM`).

## Relationship to Swimly (READ THIS)
- This repo shares **nothing** with Swimly production: separate Railway project, database, Redis, GoCardless creditor, Stripe account, domain and `.env`. Never point this repo at a Swimly resource.
- **Enforced:** `scripts/check-no-swimly.sh` fails the build if any live Swimly endpoint (domain, Fly app, Railway project, FTP host, prod DB host) appears in the repo. CI runs it on every PR and push to main; it is also verification gate 7. If it fires, remove the reference; never widen its exclusions to silence it.
- **Shared-core hygiene:** keep the generic core mergeable with Swimly so bug fixes can be cherry-picked across. Do **not** gratuitously restructure, reformat or move: `packages/shared-types`, `packages/utils`, and the `auth`, `gocardless`, `finance`, `tenancy` modules. Domain, brand and UX are free to diverge; plumbing should stay recognisable.
- The Swimly repo is `~/GitHub/team-swim`. Never edit it from this repo's sessions.

## Architecture
- **Monorepo** managed by Turborepo + pnpm (v8.15+, Node >= 20)
- **Web app** (`apps/web/`): Next.js 14 App Router + React, Tailwind CSS, shadcn/ui + Radix, TanStack Query, React Hook Form, Zod, NextAuth
- **Membership service** (`services/membership/`): NestJS, TypeORM, PostgreSQL, Redis
- **Shared packages** (`packages/shared-types`, `packages/utils`): enums, DTOs, entity types, `GOVERNING_BODY_CONFIG`
- **Marketing site** (`marketing-site/`): Astro + Tailwind. Has its own CLAUDE.md. Reskin is Phase 4 (TEM-25).
- **Payments:** GoCardless Direct Debit (primary), Stripe cards (secondary)

## Commands
```bash
pnpm install
pnpm dev              # All services in parallel
pnpm dev:web          # Web app only
pnpm dev:services     # Backend services only
pnpm build            # Build all (turbo)
pnpm test             # Run all tests
pnpm lint             # Lint all
pnpm format:check     # Check formatting
```

## Naming: Member in code, Gymnast in copy (DO NOT MIX THESE UP)
- **Code identifier is `Member`** (entity `Member`, table `members`, PK `member_id`, routes `/members`, `member/:memberId`). This future-proofs a third sport.
- **User-facing label is "Gymnast"**. Parents and coaches never see the word "Member" where they expect "Gymnast".
- All display copy goes through the display-noun constants (`MEMBER_NOUN = 'Gymnast'`, `MEMBER_NOUN_PLURAL = 'Gymnasts'`) rather than hard-coding "Gymnast", so a future sport is a one-line change. Watch plurals and possessives.
- The rename is executed per `docs/03-Swimmer-to-Member-Codemod-Spec.md` (TEM-13). Word-boundary matching only; apply the compound patterns before the bare word.
- The grep gate must return zero hits once TEM-13 lands:
  `grep -rIiw "swimmer\|swimmers\|swimmer_id\|swimmerId\|se_number" apps services packages --include=*.ts --include=*.tsx` (excluding `database/migrations/` and the excluded parsers below).

## Governing Body: British Gymnastics
- `GoverningBody.BRITISH_GYMNASTICS` is the default for this product. Config values come from `docs/01-British-Gymnastics-Compliance-Brief.md`:
  - registration number label: **BG membership number**
  - background checks: **DBS** (England & Wales), **PVG** (Scotland), **AccessNI** (Northern Ireland)
  - safeguarding framework: **Safeguarding and Protecting Children Policy** (under BG's "Safe & Fair Sport"; there is no Wavepower-style single brand name)
  - club safeguarding role: **Welfare Officer**
  - data-sharing recipient: **British Gymnastics**
- Award scheme is **BG Rise** (Discover / Explore / Excel), replacing the legacy Proficiency Awards. Model award schemes **as data**, never hard-coded, because Rise is a live transition and some clubs run their own scheme.
- Disciplines are configurable data: the 10 BG core disciplines (WAG, MAG, Rhythmic, Trampoline, DMT, Tumbling, Acrobatic, TeamGym, Aerobic, Disability) plus pre-school / adult / parkour as programme flags. Discipline drives filtering, not separate code paths.
- Items marked *[verify at build time]* in the brief must be re-checked against british-gymnastics.org before compliance copy ships.

## Competitions Module: Flagged Off
- The times/strokes competitions module (`Stroke`/`Course` enums, `personal-bests`, `times-import`, `competition-*` entities, HY3 / SportSystems parsers) is **feature-flagged off** (TEM-15). Do not delete it and do not build on it. A future gymnastics scoring module (apparatus + D/E scores) may replace it.

## Database
- PostgreSQL via TypeORM (membership service)
- Migrations in `services/membership/src/database/migrations/`; seeds in `services/membership/src/seed/` and `database/seeds/`
- **Never edit a historical migration. Schema changes are always a new migration.** The `Swimmer -> Member` rename is one new migration (renames only; Postgres renames are metadata-only).
- The fork starts with an empty database. There is no production data to protect, so keep the migration simple and honest rather than clever.
- Always create migrations for schema changes, never modify the database directly.

## Do Not Touch / Exclusions
- `.claude/worktrees/**` (stale agent copies), `node_modules`, `dist` (regenerate, never hand-edit)
- `database/migrations/*` (historical)
- `parsers/hy3-parser.ts`, `parsers/sportsystems-parser.ts` and their specs (swimming meet file formats; belong to the flagged-off module)
- Anything under `modules/gocardless` should only change deliberately. If a rename or codemod touches it, stop and review.

## Key Modules (Membership Service)
activation, admin, attendance, auth, clubs, communications, compliance (consents, dbs, safeguarding, audit-logs), data-import, email, families, finance, gocardless, health, members, parent, sessions, squads, users, waitlist, wellbeing. (`competitions` present but flagged off.)

## Web App Components
UI primitives in `apps/web/src/components/ui/`. Feature components by domain: attendance, auth, billing, communications, compliance, families, fee-structures, import, invoices, layout, mandates, members, parent, providers, sessions, settings, squads.

## Code Style Rules
- **Tailwind only** -- no inline styles in React/JSX. Never use `style={{ }}`.
- **British English** everywhere -- colour, organise, centre, programme
- **No em dashes** -- rewrite the sentence instead
- **No emojis** in code comments or UI copy
- Components use Radix / shadcn primitives with class-variance-authority for variants
- `clsx` + `tailwind-merge` for conditional class names
- Zod for all form validation; TanStack Query for server state; React Hook Form for form state

## Design Principles
- UK-centric: British spelling, UK date/currency formats, "term" not "semester"
- Calm, not cluttered. Gym halls are loud and busy; the product should feel organised and in control.
- Muted palette, generous whitespace, clear typography. Brand tokens live in one config (TEM-12) once the name is decided.
- Accessibility: WCAG AA minimum, touch targets >= 48x48px

## Positioning and Product Rules (READ THIS)
Full brief: `docs/05-Build-Brief-Positioning-and-Product-Rules.md`. Read it before any feature work.
- **We are:** the operations and compliance platform for gymnastics clubs -- waiting list to enrolled, Direct-Debit-billed, safeguarding-compliant member in one click. Works alongside My BG.
- **Positioned against:** JustGo for Clubs (British Gymnastics' official club tool, free, My BG sync, but no Direct Debit documented, manual waitlists, no badges, no club-level safeguarding), ClassForKids (card-only, +0.5%, no exports), Thrive4 (opaque pricing, proprietary DD rail), and DIY spreadsheets.
- **Rules:** Direct Debit first with GoCardless in the club's own organisation (never our own rail); compliance is a first-class module with expiry alerts and a Welfare Officer view; the hero flow is auto-offer waiting list -> one-click enrolled member; badges are data (Rise / Proficiency / club schemes) with a CSV bridge, no API dependency; BG membership number is a first-class reconcilable field; full export + API are product features; Wales runs on Sport:80, not JustGo.
- **Do not build:** competition scoring, a booking marketplace / directory, a payment rail, or anything duplicating My BG membership administration.

## Working Method
- **One Linear issue per session.** Open with the issue ID (e.g. "Implement TEM-14"), read the issue and the relevant `docs/` file, do the work, run the gates, then update the issue status.
- Respect Linear blocking relations. Do not start an issue that is blocked.
- For large changes (TEM-13 especially): produce a plan first, get it approved, then execute. One PR, small reviewable commits.
- Commit every green step. If a session drifts, stop and restart on the same issue rather than steering it back.

## Verification Gates (all must pass before "done")
1. `pnpm build` green across `apps/web`, `services/membership`, `packages/*`
2. `pnpm test` green, including every `*.tenant-isolation.spec.ts` (tenancy guarantees must survive every change untouched)
3. For schema changes: migration `up` then `down` round-trips on a fresh DB, then `up` again
4. For the rename: the grep gate above returns zero hits
5. `pnpm lint` and `pnpm format:check` clean
6. Always run `pnpm build` before reporting work as complete
7. `./scripts/check-no-swimly.sh` passes (no live Swimly endpoints anywhere in the repo)

## Testing
- Jest for unit tests
- Playwright for E2E (`tests/playwright/`), API e2e in `services/membership/src/e2e/`

## Deployment
- App: Railway (separate project from Swimly). GitHub OAuth connected via dashboard, not API.
- Marketing site: only via `marketing-site/deploy-ftp.sh`, never raw FTP (system umask 0077 breaks Astro output permissions without the script's fix).

## Git
- Commit and push when work is complete, with messages that say what changed and why
- Branch per Linear issue (use the issue's suggested branch name)

## Reference Docs
- `docs/Gymnastics-Fork-Plan.md` -- strategy, architecture, the three seams
- `docs/Gymnastics-Fork-Execution-Plan.md` -- phases, owners, exit gates, critical path
- `docs/01-British-Gymnastics-Compliance-Brief.md` -- NGB facts and the proposed config entry
- `docs/02-Founding-Club-Shortlist.md` -- target clubs and the outreach angle
- `docs/03-Swimmer-to-Member-Codemod-Spec.md` -- the rename, executable as written
- `docs/04-UK-Gymnastics-Competitive-Analysis.md` -- market structure, the NGB-endorsed tier (JustGo), positioning, plan changes
- `docs/04-Incumbent-Landscape-Pricing-and-Exports.md` -- vendor-by-vendor pricing and export formats for the importers
- `docs/05-Build-Brief-Positioning-and-Product-Rules.md` -- what to build and what not to; read before feature work
