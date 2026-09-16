# Recurring timetables (TEM-56)

## Staff workflow

Administrators and head coaches can open **Sessions > Manage term timetables**.

1. Give the term a name and inclusive first/last dates.
2. Add one or more weekly slots. Each slot keeps its squad, weekday and club-local start/end times. A squad may have several slots.
3. Enter holiday or closure dates for each slot. Preview every occurrence, current squad occupancy, capacity and available places before confirming.
4. Use **Edit** on a weekly slot to change one occurrence or that occurrence and future occurrences. An individual occurrence can move to another date within the term. Use a new slot to change the recurring weekday or squad.
5. Use **Roll over** to copy the latest weekly definitions to a later term. Enter the new term's holiday dates; old calendar dates and individual overrides are not copied.

An ordinary session edit changes only that occurrence. Recurring sessions are cancelled rather than deleted. Existing standalone sessions remain supported.

## Guarantees and boundaries

- Dated records live in the existing `sessions` table, so staff registers and family-scoped parent schedules use the same records. Holiday occurrences remain visible as cancelled, with no attendance expected.
- `occurrence_date` is the original weekly date. It and `session_id` remain stable when a session moves. `is_override` protects individual edits from later bulk changes.
- Past sessions, sessions already in progress or completed, and any session with recorded attendance are preserved. Bulk edits report all skipped dates. Attendance rows are never rewritten by timetable changes.
- The term stores the club's IANA timezone when created. Local weekly times stay constant across daylight saving changes. Ambiguous or nonexistent times are rejected unless that date is excluded.
- Places are a snapshot of `members.squad_id`, matching the existing register and parent schedule. They are not future reservations. Effective capacity is the smaller of the squad and session limits, if set. Changes to capacity or membership invalidate a creation/rollover preview, and over-capacity commits are rejected.
- Creation requires a preview token and operation UUID. Repeating the same operation returns its result; changing its payload is rejected. A source term can roll into a given target date range only once, even with concurrent requests using different operation UUIDs.
- Saving never enrols, transfers or charges anyone. It does not create invoices, credits, refunds or payment adjustments. Future-dated membership changes remain TEM-58; venue/resource conflicts remain TEM-70.
- Management endpoints require exact administrator or head-coach membership. Every term, series, squad, occurrence and operation lookup is scoped to the authenticated club; request bodies cannot choose the club.

## Storage and concurrency

Migration `1789600000000-AddRecurringTimetables` adds club-scoped terms, JSON weekly definitions, operation results and nullable session links. Composite foreign keys prevent series/term/session links crossing clubs. A unique series/occurrence key prevents duplicate materialisation. Rolling the migration down retains dated sessions as standalone records.

Writes use a short transaction with a consistent table-lock order. This also freezes squad membership and attendance during revalidation; reads continue. Terms are bounded to 366 days and 50 weekly slots. These locks can briefly delay writes in other clubs, so high-volume scheduling would warrant replacing them with a shared per-club lock protocol across membership and attendance writers.

## Verification

The focused PostgreSQL suite requires a migrated, disposable local database named `tumblebase_tem55` (also used by the existing payment isolation suite):

```sh
TEM56_TEST_DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:PORT/tumblebase_tem55 \
  pnpm --filter @club-manager/membership-service exec jest --runInBand timetable
```

The URL is explicit and restricted to localhost. It never inherits application database credentials. Coverage includes British clock changes, holiday materialisation, unchanged membership, tenant and role restrictions, current-capacity revalidation, concurrent retries, term rollover and protection of history/individual overrides. Interface tests check separate preview/confirmation, preview invalidation, over-capacity blocking, edit scope and parent exclusion.
