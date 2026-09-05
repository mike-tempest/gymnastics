# Regional product screenshots (swimly.club)

The `/us`, `/ca` and `/au` pages sell to clubs that bill in USD, CAD and AUD.
Reusing the swimly.uk screenshots on them would show GBP totals, `dd/mm/yyyy`
dates and Swim England registration numbers, which reads as a UK product with a
translated wrapper. So the app is captured once per region instead.

Nothing is faked at the browser layer. A scratch copy of the demo database is
rewritten so the club genuinely is a club in the target region, and the app then
renders its own currency, dates, governing body and venue from that.

## Running it

The pipeline needs the local stack, not production: the shared demo login on
`web-app-production-*.up.railway.app` returns 401, and pointing the fixture at a
real database would rewrite a real club.

```bash
# 1. Stop the membership service. Postgres will not drop a database that still
#    has connections open.
# 2. Rebuild the scratch database from the local demo one.
node scripts/screenshot-db-reset.mjs

# 3. Start the membership service against the scratch copy, and the web app.
#    From the repo root:
#      DB_DATABASE=swimly_screenshots DATABASE_URL= pnpm --filter @club-manager/membership-service dev
#      pnpm --filter web dev

# 4. Capture. This applies the per-region fixture and shoots each page.
node --import tsx scripts/capture-regional-screenshots.mts
```

Output lands in `public/images/app-screenshots/<region>/<page>-<desktop|mobile>.png`
and is rendered by `src/components/ProductTour.astro`.

## What the fixture changes

`scripts/screenshot-fixture.mjs` rewrites, per region:

- the club's country, currency, timezone, locale, governing body and affiliation
- invoice currency **and** invoice number prefix (the billing table renders each
  invoice's own currency, so leaving them in GBP puts pound rows underneath
  dollar summary cards)
- swimmer governing body and registration number prefix
- session venue, which is otherwise a Tunbridge Wells address
- session dates, shifted in whole weeks so the season straddles today while
  each session keeps the weekday named in its title
- invoice dates, so "this month" has real collection and some invoices are
  genuinely late

The week-rounding matters: the seed ships every session one day before the
evening it is named for, so "Learn to Swim - Monday Evening" falls on a Sunday.
The fixture corrects that too.

## Pages that are deliberately not captured

| Page | Why |
| --- | --- |
| Compliance | Built around DBS checks, which exist only in the UK. |
| Admin dashboard | Renders two empty cards for every club. See below. |
| Attendance | The register defaults to the next session and no swimmers are assigned to sessions in the demo data, so it renders an empty state. |
| Parent dashboard | `parent.service.ts` asks `Swimmer` for a `squad` relation the entity does not define, so it 500s. `/parent/invoices` takes a different path and does render. |

### The dashboard would be the best screenshot of the set

Two product bugs stop it being usable:

1. `FinanceController` declares no `@UseGuards(JwtAuthGuard, RolesGuard)`, unlike
   every sibling controller. The request is therefore never authenticated, no
   tenant context is established, and `GET /finance/dashboard` 500s for every
   club. The "This month" card falls back to "No billing activity yet".
2. `calculateAttendanceRate()` in `apps/web/src/app/page.tsx` is passed
   *upcoming* sessions, which cannot have attendance recorded against them yet,
   so the attendance card reads "No attendance recorded this week" permanently.

Fix those two and add the dashboard back to `PAGES` in the capture script.

## Known cosmetic limitation

Native `<input type="date">` controls on the billing and sessions filters render
their placeholder in the browser's UI locale. Headless Chromium ignores `--lang`
for this, so those two placeholders read `dd/mm/yyyy` in the US captures. It is
correct for CA and AU. It understates rather than overstates the product, so the
captures ship as they are.

## Rate limiting

The API throttles to 60 requests per minute per IP and a full capture exceeds
that, so `login()` retries across the throttle window. If a run still fails at
sign-in, wait a minute and re-run.
