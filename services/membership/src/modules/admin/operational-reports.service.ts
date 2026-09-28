import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { z } from 'zod';
import { isDiscipline } from '@club-manager/shared-types';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
const filters = z
  .object({
    from: day.optional(),
    to: day.optional(),
    squad_id: z.string().uuid().optional(),
    discipline: z.string().refine(isDiscipline).optional(),
    metric: z.enum(['occupancy', 'offers', 'invoiced', 'collected']).optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .strict();
type Filters = z.infer<typeof filters>;
interface Scope extends Filters {
  club: string;
  timezone: string;
  from: string;
  to: string;
  observed_at: string;
}
interface CapacityRow {
  squad_id: string;
  squad_name: string;
  discipline: string | null;
  capacity: number | null;
  assigned: number;
  reserved: number;
}
export interface MoneyRow {
  currency: string;
  minor_units: string;
  count: number;
}
export interface DetailRow {
  id: string;
  label: string;
  detail: string;
  href: string;
  minor_units?: string;
  currency?: string;
}
export const REPORT_DEFINITION_VERSION = '2026-09-19.1';
export const unavailableMetrics = [
  {
    id: 'historical_occupancy',
    label: 'Historical occupancy',
    dependency: 'TEM-58',
    reason: 'Dated class membership and capacity snapshots are not yet available.',
    definition:
      'Assigned places at the chosen historical date divided by usable capacity at that date.',
  },
  {
    id: 'enrolment_completion',
    label: 'Enrolment completion',
    dependency: 'TEM-22',
    reason:
      'An enrolled record does not yet prove completion of invitations, required consents and first collection.',
    definition:
      'Accepted entries with all required onboarding milestones completed divided by accepted entries in the issued offer cohort.',
  },
  {
    id: 'trial_conversion',
    label: 'Trial conversion',
    dependency: 'TEM-57',
    reason: 'Authoritative trial attendance and conversion windows are not yet available.',
    definition:
      'Attended trial participants completing enrolment within the agreed window divided by attended trial participants whose window has matured.',
  },
  {
    id: 'retention',
    label: 'Club and class retention',
    dependency: 'TEM-58',
    reason: 'Dated membership intervals and departure reasons are not yet available.',
    definition:
      'Opening cohort still enrolled at period end divided by the opening cohort. Class transfers and promotions are distinct from club departures.',
  },
  {
    id: 'arrears',
    label: 'Arrears after credits and refunds',
    dependency: 'TEM-59',
    reason: 'The complete credit/refund balance contract has not yet been released.',
    definition:
      'Positive overdue issued balances as of the club-local date, after confirmed allocations and valid credits, with refunds following the ledger contract.',
  },
  {
    id: 'forecast',
    label: 'Uninvoiced forecast',
    dependency: 'TEM-59',
    reason: 'A reliable preview of uninvoiced scheduled obligations is not yet available.',
    definition:
      'Future scheduled fee obligations excluding amounts already invoiced; assumptions and coverage must be visible.',
  },
];
export function reportCsv(rows: DetailRow[]) {
  const cell = (value: unknown) => {
    let text = String(value ?? '');
    if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  return (
    [
      ['id', 'label', 'detail', 'amount_minor_units', 'currency'],
      ...rows.map((r) => [r.id, r.label, r.detail, r.minor_units ?? '', r.currency ?? '']),
    ]
      .map((row) => row.map(cell).join(','))
      .join('\r\n') + '\r\n'
  );
}
export function summariseCapacity(rows: CapacityRow[]) {
  const known = rows.filter((r) => r.capacity !== null && r.capacity > 0);
  const assigned = known.reduce((sum, r) => sum + r.assigned, 0);
  const capacity = known.reduce((sum, r) => sum + r.capacity!, 0);
  return {
    assigned,
    capacity,
    rate_percent: capacity ? Math.round((assigned / capacity) * 10000) / 100 : null,
    reserved: rows.reduce((sum, r) => sum + r.reserved, 0),
    unknown_capacity_classes: rows.length - known.length,
    assigned_without_capacity: rows
      .filter((r) => !r.capacity || r.capacity < 0)
      .reduce((sum, r) => sum + r.assigned, 0),
    class_count: rows.length,
  };
}
@Injectable()
export class OperationalReportsService {
  constructor(
    private readonly db: DataSource,
    private readonly tenant: TenantContextService,
  ) {}
  private async scope(em: EntityManager, query: unknown): Promise<Scope> {
    const parsed = filters.safeParse(query);
    if (!parsed.success)
      throw new BadRequestException('Use valid dates, class, discipline and report filters');
    const club = this.tenant.getClubId();
    const [clock] = await em.query(
      "SELECT COALESCE(timezone,'Europe/London') AS timezone,to_char(now() AT TIME ZONE COALESCE(timezone,'Europe/London'),'YYYY-MM-DD') AS today,now() AS observed_at FROM clubs WHERE id=$1",
      [club],
    );
    if (!clock) throw new NotFoundException('Club not found');
    const from = parsed.data.from ?? clock.today.slice(0, 7) + '-01';
    const to = parsed.data.to ?? clock.today;
    if (from > to || Date.parse(to) - Date.parse(from) > 366 * 86400000)
      throw new BadRequestException('Choose an ordered date range of up to 367 days');
    if (
      parsed.data.squad_id &&
      !(
        await em.query('SELECT squad_id FROM squads WHERE club_id=$1 AND squad_id=$2', [
          club,
          parsed.data.squad_id,
        ])
      ).length
    )
      throw new NotFoundException('Class not found');
    return {
      ...parsed.data,
      club,
      from,
      to,
      timezone: clock.timezone,
      observed_at: new Date(clock.observed_at).toISOString(),
    };
  }
  private params(scope: Scope) {
    return [
      scope.club,
      scope.squad_id ?? null,
      scope.discipline ?? null,
      scope.from,
      scope.to,
      scope.timezone,
    ];
  }
  private async capacity(em: EntityManager, s: Scope): Promise<CapacityRow[]> {
    // The join table is authoritative for class capacity and auto-offer. The
    // legacy primary squad field is not a second enrolment to count again.
    return em.query(
      `SELECT s.squad_id,s.squad_name,s.discipline,s.max_capacity AS capacity,
      (SELECT count(DISTINCT m.member_id)::int FROM squad_members sm JOIN members m ON m.member_id=sm.member_id AND m.club_id=s.club_id WHERE sm.squad_id=s.squad_id) AS assigned,
      (SELECT count(*)::int FROM waiting_list_offers o WHERE o.club_id=s.club_id AND o.squad_id=s.squad_id AND o.status='pending') AS reserved
      FROM squads s WHERE s.club_id=$1 AND ($2::uuid IS NULL OR s.squad_id=$2) AND ($3::text IS NULL OR s.discipline=$3) ORDER BY s.squad_name,s.squad_id`,
      this.params(s).slice(0, 3),
    );
  }
  private offerFrom = `FROM waiting_list_offers o JOIN squads s ON s.squad_id=o.squad_id AND s.club_id=o.club_id WHERE o.club_id=$1 AND ($2::uuid IS NULL OR s.squad_id=$2) AND ($3::text IS NULL OR s.discipline=$3) AND o.offered_at>=($4::date::timestamp AT TIME ZONE $6) AND o.offered_at<(($5::date+1)::timestamp AT TIME ZONE $6)`;
  private async money(
    em: EntityManager,
    s: Scope,
    metric: 'invoiced' | 'collected',
  ): Promise<MoneyRow[]> {
    if (metric === 'invoiced')
      return em.query(
        "SELECT currency,round(sum(total_amount)*100)::bigint::text AS minor_units,count(*)::int AS count FROM invoices WHERE club_id=$1 AND issued_date BETWEEN $2 AND $3 AND status NOT IN ('draft','cancelled') GROUP BY currency ORDER BY currency",
        [s.club, s.from, s.to],
      );
    return em.query(
      "SELECT p.currency,round(sum(p.amount)*100)::bigint::text AS minor_units,count(*)::int AS count FROM payments p JOIN invoices i ON i.invoice_id=p.invoice_id AND i.club_id=p.club_id WHERE p.club_id=$1 AND p.payment_date BETWEEN $2 AND $3 AND p.status='confirmed' GROUP BY p.currency ORDER BY p.currency",
      [s.club, s.from, s.to],
    );
  }
  async summary(query: unknown) {
    return this.db.transaction('REPEATABLE READ', async (em) => {
      const scope = await this.scope(em, query);
      const classes = await this.capacity(em, scope);
      const statuses: { status: string; count: number }[] = await em.query(
        `SELECT o.status,count(*)::int AS count ${this.offerFrom} GROUP BY o.status`,
        this.params(scope),
      );
      const count = (status: string) => statuses.find((row) => row.status === status)?.count ?? 0;
      const issued = statuses.reduce((sum, row) => sum + row.count, 0);
      const accepted = count('accepted');
      const resolved = accepted + count('declined') + count('expired');
      const filtered = !!(scope.squad_id || scope.discipline);
      const unavailableMoney = {
        status: 'unavailable' as const,
        reason:
          'Family invoices and payments lack reliable class allocation. Clear class and discipline filters to see club totals.',
      };
      return {
        definition_version: REPORT_DEFINITION_VERSION,
        observed_at: scope.observed_at,
        timezone: scope.timezone,
        from: scope.from,
        to: scope.to,
        scope: { squad_id: scope.squad_id ?? null, discipline: scope.discipline ?? null },
        occupancy: {
          status: 'available' as const,
          ...summariseCapacity(classes),
          definition:
            'Current assigned places / current usable capacity, weighted across classes. Pending offers reserve places separately. Date filters do not reconstruct past capacity.',
        },
        offers: {
          status: 'available' as const,
          issued,
          accepted,
          resolved,
          declined: count('declined'),
          expired: count('expired'),
          withdrawn: count('withdrawn'),
          pending: count('pending'),
          unrecognised_status:
            issued -
            statuses
              .filter((r) =>
                ['accepted', 'declined', 'expired', 'withdrawn', 'pending'].includes(r.status),
              )
              .reduce((sum, r) => sum + r.count, 0),
          rate_percent: issued ? Math.round((accepted / issued) * 10000) / 100 : null,
          resolved_rate_percent: resolved ? Math.round((accepted / resolved) * 10000) / 100 : null,
          definition:
            'Offers issued in the club-local date range; responses observed now. Issued-cohort acceptance includes pending and withdrawn offers in the denominator. Resolved acceptance excludes both. Discipline uses the current class classification.',
        },
        invoiced: filtered
          ? unavailableMoney
          : {
              status: 'available' as const,
              totals: await this.money(em, scope, 'invoiced'),
              definition:
                'Gross face value of non-draft, non-cancelled invoices by issued date. Credits are not netted here.',
            },
        collected: filtered
          ? unavailableMoney
          : {
              status: 'available' as const,
              totals: await this.money(em, scope, 'collected'),
              definition:
                'Gross currently confirmed payment allocations by business payment date. Excludes pending/failed payments; not bank settlement or net of refunds.',
            },
        unavailable: unavailableMetrics.map((metric) => ({
          ...metric,
          status: 'unavailable' as const,
          first_supported_date: null,
        })),
      };
    });
  }
  private async detailsWithin(
    em: EntityManager,
    s: Scope,
    exportAll = false,
  ): Promise<{ total: number; rows: DetailRow[] }> {
    const metric = s.metric ?? 'occupancy';
    if ((metric === 'invoiced' || metric === 'collected') && (s.squad_id || s.discipline))
      throw new BadRequestException('Class allocation is unavailable for family finances');
    let sql: string;
    let params: unknown[];
    if (metric === 'occupancy') {
      const rows = await this.capacity(em, s);
      return {
        total: rows.length,
        rows: (exportAll ? rows : rows.slice((s.page - 1) * 100, s.page * 100)).map((r) => ({
          id: r.squad_id,
          label: r.squad_name,
          detail: `${r.assigned} assigned; ${r.capacity ?? 'unknown'} capacity; ${r.reserved} reserved`,
          href: `/squads/${r.squad_id}`,
        })),
      };
    }
    if (metric === 'offers') {
      sql = `SELECT o.offer_id AS id,s.squad_name AS label,o.status||'; issued '||to_char(o.offered_at AT TIME ZONE $6,'YYYY-MM-DD HH24:MI') AS detail,'/waiting-list/'||o.entry_id AS href ${this.offerFrom}`;
      params = this.params(s);
    } else if (metric === 'invoiced') {
      sql =
        "SELECT invoice_id AS id,invoice_number AS label,issued_date::text AS detail,'/invoices/'||invoice_id AS href,round(total_amount*100)::bigint::text AS minor_units,currency FROM invoices WHERE club_id=$1 AND issued_date BETWEEN $2 AND $3 AND status NOT IN ('draft','cancelled')";
      params = [s.club, s.from, s.to];
    } else {
      sql =
        "SELECT p.payment_id AS id,i.invoice_number AS label,p.payment_date::text AS detail,'/invoices/'||i.invoice_id AS href,round(p.amount*100)::bigint::text AS minor_units,p.currency FROM payments p JOIN invoices i ON i.invoice_id=p.invoice_id AND i.club_id=p.club_id WHERE p.club_id=$1 AND p.payment_date BETWEEN $2 AND $3 AND p.status='confirmed'";
      params = [s.club, s.from, s.to];
    }
    const [count] = await em.query(`SELECT count(*)::int AS total FROM (${sql}) records`, params);
    if (exportAll && count.total > 10000)
      throw new BadRequestException('Narrow the filters to export at most 10,000 records');
    const limit = exportAll ? 10000 : 100;
    const offset = exportAll ? 0 : (s.page - 1) * 100;
    const rows: DetailRow[] = await em.query(
      `${sql} ORDER BY id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
    return { total: count.total as number, rows };
  }
  async details(query: unknown) {
    return this.db.transaction('REPEATABLE READ', async (em) => {
      const scope = await this.scope(em, query);
      return {
        definition_version: REPORT_DEFINITION_VERSION,
        observed_at: scope.observed_at,
        page: scope.page,
        ...(await this.detailsWithin(em, scope)),
      };
    });
  }
  async export(query: unknown) {
    return this.db.transaction('REPEATABLE READ', async (em) => {
      const scope = await this.scope(em, query);
      const result = await this.detailsWithin(em, scope, true);
      if (result.total > 10000)
        throw new BadRequestException('Narrow the filters to export at most 10,000 records');
      return reportCsv(result.rows);
    });
  }
}
