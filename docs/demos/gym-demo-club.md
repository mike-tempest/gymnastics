# Demo club: Kestrel Vale Gymnastics Club

The British Gymnastics demo club. One seed script, one tenant, safe to run
repeatedly against a local database.

Kestrel Vale is fictional. The club, its staff, its families and every
reference number are invented. Addresses use real Charnwood (Leicestershire)
place names so the data reads like a real club's; phone numbers come from the
Ofcom `07700 900xxx` range reserved for fiction; and the DBS, PVG, AccessNI and
British Gymnastics membership numbers belong to nobody.

- Seed: `services/membership/src/seed/gym-demo-seed.ts`
- Script: `pnpm seed:demo:gym` (from `services/membership`)
- Slug: `kestrel-vale-gymnastics`

## Running it safely

> **DANGER.** The repository root `.env` points at a deployed database. Always
> pass `DB_*` explicitly so the seed cannot reach it, and never run the seed
> with `NODE_ENV=production` (it refuses, but do not rely on that alone).

```bash
createdb -h localhost -U postgres my_local_db      # or: docker exec swim-nexus-db createdb -U postgres my_local_db

cd services/membership
DB_HOST=localhost DB_PORT=5432 DB_USERNAME=postgres DB_PASSWORD=postgres \
  DB_DATABASE=my_local_db pnpm db:migrate

DB_HOST=localhost DB_PORT=5432 DB_USERNAME=postgres DB_PASSWORD=postgres \
  DB_DATABASE=my_local_db pnpm seed:demo:gym
```

The seed is idempotent. It deletes any existing `kestrel-vale-gymnastics` club
and everything hanging off it, then rebuilds, so a second run replaces the
first rather than duplicating it. Every delete and every insert is scoped by
`club_id`, so another club in the same database is untouched.

## Logins

Every user shares the password `Demo2024!`.

| Role            | Email                                              |
| --------------- | -------------------------------------------------- |
| Super admin     | `admin@kestrelvalegym.org.uk`                      |
| Head coach      | `rachel.oduya@kestrelvalegym.org.uk`               |
| Squad coach     | `tom.beresford@kestrelvalegym.org.uk`              |
| Welfare Officer | `gemma.laird@kestrelvalegym.org.uk`                |
| Treasurer       | `david.pryce@kestrelvalegym.org.uk`                |
| Parent          | `claire.ashworth@example.com` (and one per family) |

## What the seed creates

**Club.** Country `GB`, currency `GBP`, timezone `Europe/London`, locale
`en-GB`, governing body `BRITISH_GYMNASTICS`, region England, affiliation
number `BG-15342`. Tax is configured but zero: most British Gymnastics clubs
are non-profit and their coaching is VAT exempt, so invoices carry no VAT while
the settings screens still show what a VAT-registered club would see.

**Squads (8).** The shape of a real gym club: a wide recreational base and a
narrow competitive pathway.

| Squad                                    | Type         | Level            | Discipline | Programme  |
| ---------------------------------------- | ------------ | ---------------- | ---------- | ---------- |
| Tumble Tots                              | recreational | Rise Discover    | -          | Pre-school |
| Recreational Gymnastics: Explore Group A | recreational | Rise Explore 1-2 | WAG        | -          |
| Recreational Gymnastics: Explore Group B | recreational | Rise Explore 3-5 | WAG        | -          |
| Boys' Recreational Gymnastics            | recreational | Rise Explore 1-3 | MAG        | -          |
| Trampoline Recreational                  | recreational | Rise Explore 2-5 | Trampoline | -          |
| Women's Artistic Development Squad       | competitive  | -                | WAG        | -          |
| TeamGym Squad                            | competitive  | -                | TeamGym    | -          |
| Adult Gymnastics                         | recreational | -                | -          | Adult      |

**People.** 5 staff users, 8 families with a parent user each, 16 members. Each
member carries a BG membership number and, where the squad has one, a
discipline. British Gymnastics publishes no membership number format, so the
seed deliberately mixes plain digits (`2104517`) with prefixed forms
(`BG-3391204`, `BG7781`) to prove the field accepts either. Two members carry
medical notes and one family's members carry emergency contacts.

**Awards.** Both starter schemes the awards module ships are installed as
ordinary rows: British Gymnastics Rise (15 levels across Discover, Explore and
Excel) and the legacy Proficiency Awards (9 levels, installed inactive, for a
club part-way through the transition). Nothing is special-cased; the club can
rename, reprice or delete any of it.

Rise levels carry a £3.50 badge fee and a £1.50 certificate fee, linked to the
"Rise Badge and Certificate" fee structure. 50 progress records give a
believable spread: levels below a gymnast's stage are awarded, the stage itself
is assessed and waiting on sign-off, and the next one is being worked towards.
Three assessment events, one per journey, record 10 outcomes. Where a badge was
signed off in the current billing period the £5.00 charge appears on the
family's invoice and the progress row points back at it, which is the route
every award fee takes.

Adult gymnasts are on no scheme. Rise is a children's programme and the demo
does not pretend otherwise.

**Sessions and attendance.** 15 weekly session templates across the eight
squads at Kestrel Vale Gymnastics Centre, run over six weeks: the past four
completed, the next two scheduled. 120 attendance records against the completed
sessions, deterministic so re-runs are stable (roughly 85% present, 8% absent,
7% late).

**Finance.** 10 fee structures in GBP: recreational classes bill per term
(£45-£96), the competitive squads bill monthly (£62-£78) on the Direct Debit
cycle, plus an annual club membership and the one-off Rise badge fee. 8
invoices, one per family, across `paid` / `pending` / `overdue` / `draft`, with
payments recorded for the paid ones and 6 Bacs mandates (5 active, 1 pending).

Mandate rows are written directly rather than through GoCardless, the same
demo path the Australian seed uses. Nothing here calls a payment provider.

**Compliance.** 5 background checks spanning the home nations: Enhanced DBS
with barred list for the coaching staff, one Enhanced DBS inside the 90-day
window so the dashboard shows an expiring check, one PVG scheme membership
(Scotland) and one AccessNI check (Northern Ireland). A Welfare Officer,
working to British Gymnastics' Safeguarding and Protecting Children Policy. 48
consent records across medical treatment, photography and data sharing with
British Gymnastics, with a deterministic scattering of denials.

**Not seeded.** The times and strokes competitions module is feature-flagged
off for this product (TEM-15), so the seed writes nothing to it.

## Other demo seeds

`pnpm seed:demo:au` seeds Manly Sharks Swimming Club, kept as the non-UK,
non-GBP example: it exercises AUD, GST-inclusive pricing, Working With Children
Checks and a different governing body. The two seeds use different slugs and
can coexist in one database.
