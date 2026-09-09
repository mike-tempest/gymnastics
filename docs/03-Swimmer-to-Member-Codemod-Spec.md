# `Swimmer → Member` — Codemod & Migration Spec

**Purpose:** an agent-executable, one-pass rename of the core member entity in the gymnastics fork of `team-swim`.
**Scope basis:** measured against the current `team-swim` working tree (4 Sep 2026).
**Decision baked in:** code noun = **`Member`**; user-facing label = **"Gymnast"** (see §3 — these are deliberately different).

---

## 1. The measured rename surface

| Layer                              | Files touching `swimmer` | Notes                                                                                                                                                 |
| ---------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend `services/membership/src`  | **144**                  | Heaviest: competitions (19), migrations (15 — _historical, do not edit_), compliance (13), swimmers module (11), wellbeing/squads/attendance (8 each) |
| Frontend `apps/web/src`            | **83**                   | `lib/api` (11), `app/swimmers` (8), `components/competitions` (6), `app/admin` (6), `app/parent` (5), plus scattered nav/layout/middleware refs       |
| Shared `packages/shared-types/src` | **10**                   | `swimmer.dto.ts`, `swimmer.entity.ts`, `entities/index.ts`, and refs inside attendance/competition/session/family/squad entity types                  |

**Database objects (Postgres, via TypeORM):**

| Kind                      | Current name                                                                                                                                               | New name                                                                                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Table                     | `swimmers`                                                                                                                                                 | `members`                                                                                                                                             |
| Table                     | `swimmer_cycle_logs`                                                                                                                                       | `member_cycle_logs`                                                                                                                                   |
| Table                     | `swimmer_wellbeing_logs`                                                                                                                                   | `member_wellbeing_logs`                                                                                                                               |
| Join table                | `squad_swimmers`                                                                                                                                           | `squad_members`                                                                                                                                       |
| PK column                 | `swimmers.swimmer_id`                                                                                                                                      | `members.member_id`                                                                                                                                   |
| FK column `swimmer_id` in | `attendance`, `competition_entries`, `competition_results`, `personal_bests`, `consents`, `squad_swimmers`, `swimmer_cycle_logs`, `swimmer_wellbeing_logs` | `member_id` in each                                                                                                                                   |
| Column (recommended)      | `swimmers.se_number`                                                                                                                                       | `members.registration_number` — the field is already governing-body-agnostic via `governing_body`; the Swim-England-specific name is the only residue |

**Named constraints/indexes to rename** (all measured from the migrations):

```
FK_ATTENDANCE_SWIMMER            → FK_ATTENDANCE_MEMBER
FK_CYCLE_SWIMMER                 → FK_CYCLE_MEMBER
FK_SWIMMERS_FAMILY               → FK_MEMBERS_FAMILY
FK_WELLBEING_SWIMMER             → FK_WELLBEING_MEMBER
IDX_ATTENDANCE_SWIMMER_ID        → IDX_ATTENDANCE_MEMBER_ID
IDX_COMPETITION_ENTRIES_SWIMMER_ID → IDX_COMPETITION_ENTRIES_MEMBER_ID
IDX_COMPETITION_RESULTS_SWIMMER_ID → IDX_COMPETITION_RESULTS_MEMBER_ID
IDX_CONSENTS_SWIMMER_ID          → IDX_CONSENTS_MEMBER_ID
IDX_CYCLE_SWIMMER_ID             → IDX_CYCLE_MEMBER_ID
IDX_PERSONAL_BESTS_SWIMMER_ID    → IDX_PERSONAL_BESTS_MEMBER_ID
IDX_SQUAD_SWIMMERS_SQUAD_ID      → IDX_SQUAD_MEMBERS_SQUAD_ID
IDX_SQUAD_SWIMMERS_SWIMMER_ID    → IDX_SQUAD_MEMBERS_MEMBER_ID
IDX_SWIMMERS_CLUB_FAMILY         → IDX_MEMBERS_CLUB_FAMILY
IDX_SWIMMERS_CLUB_ID             → IDX_MEMBERS_CLUB_ID
IDX_SWIMMERS_FAMILY_ID           → IDX_MEMBERS_FAMILY_ID
IDX_SWIMMERS_LAST_NAME           → IDX_MEMBERS_LAST_NAME
IDX_SWIMMERS_SQUAD_ID            → IDX_MEMBERS_SQUAD_ID
IDX_WELLBEING_SWIMMER_ID         → IDX_WELLBEING_MEMBER_ID
UQ_ATTENDANCE_SESSION_SWIMMER    → UQ_ATTENDANCE_SESSION_MEMBER
UQ_PERSONAL_BESTS_SWIMMER_EVENT  → UQ_PERSONAL_BESTS_MEMBER_EVENT
UQ_SWIMMERS_BODY_SE_NUMBER       → UQ_MEMBERS_BODY_REGISTRATION_NUMBER
UQ_WELLBEING_SWIMMER_DATE        → UQ_WELLBEING_MEMBER_DATE
```

> ⚠️ **Do not rename `UQ_swimmers_se_number`.** It appears in the migration history but was **dropped** by `1744201200000-AddGoverningBodyToSwimmers` (replaced by the composite `UQ_SWIMMERS_BODY_SE_NUMBER`). It does not exist on a live schema; an unguarded `RENAME CONSTRAINT` on it will fail the migration. If you want belt-and-braces, use `DROP INDEX IF EXISTS "UQ_swimmers_se_number"` as that migration itself does.

**API routes to rename:**

```
@Controller('swimmers')                       → @Controller('members')
attendance:   GET swimmer/:swimmerId[/stats]  → member/:memberId[/stats]
competitions: GET swimmer/:swimmerId/results | /personal-bests → member/:memberId/…
consents:     GET swimmer/:swimmerId[/status|/has/:consentType] → member/:memberId/…
wellbeing:    GET swimmer/:swimmerId/history | /today → member/:memberId/…
squads:       :id/swimmers, :id/swimmers/:swimmerId → :id/members, :id/members/:memberId
web:          app/swimmers/**  → app/members/**   (+ middleware.ts route guard, nav links)
```

---

## 2. Canonical rename map (apply in this precedence order — longest/most specific first)

| Pattern (word-boundary)               | Replacement                                                         | Applies to                                      |
| ------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------- |
| `swimmer_wellbeing_logs`              | `member_wellbeing_logs`                                             | table names, migrations (new only)              |
| `swimmer_cycle_logs`                  | `member_cycle_logs`                                                 | table names                                     |
| `squad_swimmers`                      | `squad_members`                                                     | join table                                      |
| `SwimmerWellbeing…` / `SwimmerCycle…` | `MemberWellbeing…` / `MemberCycle…`                                 | classes/types                                   |
| `swimmerId`                           | `memberId`                                                          | camelCase identifiers, route params, DTO fields |
| `swimmer_id`                          | `member_id`                                                         | snake_case columns, FK names                    |
| `SWIMMER_ID` / `SWIMMERS` / `SWIMMER` | `MEMBER_ID` / `MEMBERS` / `MEMBER`                                  | constants, constraint names                     |
| `Swimmers` / `swimmers`               | `Members` / `members`                                               | classes, table, routes, folders                 |
| `Swimmer` / `swimmer`                 | `Member` / `member`                                                 | everything else                                 |
| `se_number` / `seNumber` / `SeNumber` | `registration_number` / `registrationNumber` / `RegistrationNumber` | the SE-specific field (recommended)             |

Rules: **word-boundary matching only** (`\bswimmer\b` etc.) so `Swimmers` doesn't double-convert and unrelated words are untouched; process the specific compound patterns _before_ the bare `swimmer`.

---

## 3. Code noun vs display label — keep them separate

- **Code identifier: `Member`.** Future-proof: a third sport never forces this rename again.
- **User-facing copy: "Gymnast".** Parents and coaches say "gymnast", never "member".

**Rule:** the codemod renames _identifiers, routes, tables, filenames_. It must **not** blindly rewrite user-facing strings to "Member". Handle copy as a separate, reviewed pass:

1. Collect all UI strings containing `Swimmer`/`swimmer` (JSX text, labels, toasts, emails in `modules/email` + `communications`, `safeguarding-templates.ts`).
2. Route them through a single display-noun constant/i18n key (e.g. `MEMBER_NOUN = 'Gymnast'`, `MEMBER_NOUN_PLURAL = 'Gymnasts'`) rather than hard-coding "Gymnast" — so a future sport is a one-line change.
3. Watch for pluralisation and possessives ("swimmer's", "swimmers'").

This separation is the single most common place a naive rename produces an embarrassing UI ("Add Member" where a coach expects "Add Gymnast").

---

## 4. Exclusions — do NOT rename

- **Historical migrations** (`database/migrations/*`, 46 files, 15 mention swimmer): leave untouched. Schema history is immutable; the rename is a _new_ migration (§5).
- **Swim-specific competition import parsers** — `parsers/hy3-parser.ts`, `parsers/sportsystems-parser.ts` (+ specs, `parser-factory`, `parser.interface`): these are swimming-meet file formats (HY3/SportSystems). They belong to the _feature-flagged-off_ competitions module. Rename identifiers for build hygiene only if the flag-off doesn't exclude them from compilation; otherwise leave and let the flag remove them.
- **`.claude/worktrees/**`\*\* — agent worktree copies; exclude from all greps and edits.
- **`node_modules`, `dist`** — obviously.
- **Third-party/GoCardless field names** — nothing there uses `swimmer`; if the codemod touches anything under `modules/gocardless`, stop and review.

---

## 5. The migration (one new TypeORM migration; never edit old ones)

File: `services/membership/src/database/migrations/<timestamp>-RenameSwimmerToMember.ts`

`up()` in this order (Postgres supports all as in-place renames — no data copy):

1. `ALTER TABLE swimmers RENAME TO members;`
2. `ALTER TABLE members RENAME COLUMN swimmer_id TO member_id;`
3. `ALTER TABLE members RENAME COLUMN se_number TO registration_number;` _(recommended)_
4. Rename `swimmer_cycle_logs → member_cycle_logs`, `swimmer_wellbeing_logs → member_wellbeing_logs`, `squad_swimmers → squad_members`.
5. `ALTER TABLE <attendance|competition_entries|competition_results|personal_bests|consents|squad_members|member_cycle_logs|member_wellbeing_logs> RENAME COLUMN swimmer_id TO member_id;`
6. `ALTER TABLE … RENAME CONSTRAINT <old> TO <new>;` for every FK/UQ in §1.
7. `ALTER INDEX <old> RENAME TO <new>;` for every IDX in §1.

`down()` is the exact reverse. **Renames are metadata-only in Postgres — no table rewrite, safe on any size.**

**Fork advantage:** the gymnastics fork starts with a **fresh, empty database** — there is no production data to protect. The additive migration is still the right choice (keeps the migration runner and test fixtures working, and keeps schema history honest), but you have zero data-migration risk here. Don't over-engineer it.

**Regenerate** `services/membership/dist` (it's checked in / built) rather than hand-editing it.

---

## 6. Execution recipe (for a build agent)

```
0. Branch: feat/rename-swimmer-to-member  (in the FORK repo, never in team-swim)
1. Filesystem: git mv
   services/membership/src/modules/swimmers          → modules/members
   apps/web/src/app/swimmers                          → app/members
   apps/web/src/components/swimmers                   → components/members
   packages/shared-types/src/{dtos,entities}/swimmer.* → member.*
   swimmer.entity.ts / swimmers.controller.ts / … → member.* / members.*
2. Identifiers: ts-morph rename (symbol-aware) for Swimmer, Swimmers, swimmerId, swimmer_id,
   SeNumber/seNumber → apply §2 map, longest-first, word-boundary.
3. Strings/decorators (not symbol-aware — regex, word-boundary): @Entity('…'), @Controller('…'),
   @Get('swimmer/:swimmerId…'), @JoinColumn({ name: 'swimmer_id' }), @Unique/@Index arrays,
   API client paths in apps/web/src/lib/api, middleware.ts route matchers, nav hrefs.
4. New migration per §5.
5. Display-noun pass per §3 (separate commit, reviewed).
6. Rebuild dist; run the grep gate (§7); run tests.
```

Keep it as **one PR, three commits**: (a) files + identifiers + routes, (b) migration, (c) display copy. Reviewable, bisectable.

---

## 7. Verification gates (all must pass)

1. **Grep gate:** `grep -rIiw "swimmer\|swimmers\|swimmer_id\|swimmerId\|se_number" apps services packages --include=*.ts --include=*.tsx` returns **zero** hits outside `database/migrations/` and the excluded parsers.
2. **Build:** `pnpm turbo build` green across `apps/web`, `services/membership`, `packages/*`.
3. **Unit + tenant isolation:** all `*.spec.ts` incl. `members.tenant-isolation.spec.ts` (renamed from `swimmers.tenant-isolation.spec.ts`) — the tenancy guarantees must survive the rename untouched.
4. **Migration round-trip:** on a fresh DB, run `up` → schema dump → run `down` → schema matches pre-state; then `up` again.
5. **E2E:** `e2e/api.e2e.test.ts` + Playwright suite pass against the renamed routes.
6. **Seeds:** `seed/demo-seed.ts` (and `au-demo-seed.ts` if kept) run clean and produce a demo gymnastics club.
7. **UI smoke:** no visible "Member" where "Gymnast" is expected (§3), nav links resolve to `/members`.

---

## 8. Risks & gotchas

- **Symbol vs string mismatch** — ts-morph renames symbols, but decorators, route strings, `@JoinColumn` names and API paths are _strings_; if you only do one of the two, the app builds and then 404s. Do both (§6 steps 2 and 3), then rely on the grep gate.
- **`se_number` rename touches uniqueness** — `UQ_SWIMMERS_BODY_SE_NUMBER` is the "unique within a governing body" constraint (the comment in the entity explains two home nations can issue the same digits). Preserve that semantics exactly under the new name.
- **Historical migrations reference old names** — that's correct and expected; they run first and the new migration renames afterwards. Never "fix" them.
- **Cherry-pick friction with Swimly** — after this rename, fixes in Swimly's generic core (`gocardless`, `finance`, `auth`, `tenancy`) will need the §2 map applied when ported across. Acceptable; note it in the fork's CONTRIBUTING.
- **Worktrees** — `.claude/worktrees/` contains stale copies of the whole tree; exclude or you'll double-count and mis-edit.
