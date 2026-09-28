import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { z } from 'zod';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { AwardSkillsService } from './award-skills.service';
import { parseAwardInput } from './award-skills.schemas';
import { InvoicesService, invoiceTotals } from '../finance/invoices/invoices.service';
import { Invoice } from '../finance/invoices/entities/invoice.entity';
import { AssessmentEvent } from './entities/assessment-event.entity';
import { regionForCountry } from '../../common/region/region.util';
import { MEMBER_NOUN_LOWER } from '../../common/brand';

const previewSchema = z
  .object({
    level_id: z.string().uuid(),
    member_ids: z.array(z.string().uuid()).min(1).max(500),
  })
  .strict();
const awardSchema = z
  .object({
    request_key: z.string().uuid(),
    level_id: z.string().uuid(),
    assessed_at: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((v) => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v),
    notes: z.string().max(4000).nullable().optional(),
    bill_fees: z.boolean().default(false),
    fee_preview_hash: z.string().length(64).optional(),
    outcomes: z
      .array(
        z
          .object({
            member_id: z.string().uuid(),
            outcome: z.enum(['awarded', 'not_yet', 'working_towards']),
            notes: z.string().max(4000).nullable().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(500),
  })
  .strict();
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

@Injectable()
export class AwardBillingService {
  constructor(
    private readonly db: DataSource,
    private readonly tenant: TenantContextService,
    private readonly skills: AwardSkillsService,
    private readonly invoices: InvoicesService,
  ) {}

  private async previewWithin(em: EntityManager, levelId: string, memberIds: string[]) {
    const clubId = this.tenant.getClubId();
    const level = await this.skills.level(em, levelId, true);
    // Pricing and family moves use ordinary row locks as well as the award lock.
    await em.query('SELECT level_id FROM award_levels WHERE club_id=$1 AND level_id=$2 FOR SHARE', [
      clubId,
      levelId,
    ]);
    const [club] = await em.query(
      'SELECT currency,country,tax_rate,tax_inclusive FROM clubs WHERE id=$1 FOR SHARE',
      [clubId],
    );
    const members = await em.query(
      'SELECT member_id,family_id,first_name,last_name FROM members WHERE club_id=$1 AND member_id=ANY($2::uuid[]) ORDER BY member_id FOR SHARE',
      [clubId, memberIds],
    );
    if (new Set(memberIds).size !== memberIds.length)
      throw new BadRequestException(`Each ${MEMBER_NOUN_LOWER} must appear once`);
    if (members.length !== memberIds.length)
      throw new NotFoundException(`${MEMBER_NOUN_LOWER} not found`);
    const items = [
      { description: `${level.name} badge`, unit_price: Number(level.badge_fee ?? 0), quantity: 1 },
      {
        description: `${level.name} certificate`,
        unit_price: Number(level.certificate_fee ?? 0),
        quantity: 1,
      },
    ]
      .filter((i) => i.unit_price > 0)
      .map((i) => ({
        ...i,
        ...(level.fee_structure_id ? { fee_structure_id: level.fee_structure_id } : {}),
      }));
    const rows = [];
    for (const member of members) {
      const [existing] = await em.query(
        'SELECT invoice_id FROM award_invoice_sources WHERE club_id=$1 AND member_id=$2 AND level_id=$3',
        [clubId, member.member_id, levelId],
      );
      const [family] = member.family_id
        ? await em.query(
            'SELECT family_id,family_name FROM families WHERE club_id=$1 AND family_id=$2 FOR SHARE',
            [clubId, member.family_id],
          )
        : [];
      const reason = existing
        ? 'already_invoiced'
        : !family
          ? 'no_family'
          : !items.length
            ? 'no_fee'
            : null;
      rows.push({
        member_id: member.member_id,
        member_name: `${member.first_name} ${member.last_name}`,
        family_id: family?.family_id ?? null,
        family_name: family?.family_name ?? null,
        existing_invoice_id: existing?.invoice_id ?? null,
        reason,
        items: reason ? [] : items,
        ...invoiceTotals(reason ? 0 : items.reduce((sum, i) => sum + i.unit_price, 0), club),
      });
    }
    const preview = {
      level_id: levelId,
      level_name: level.name,
      currency: club.currency ?? regionForCountry(club.country).currency,
      tax_rate: club.tax_rate,
      tax_inclusive: club.tax_inclusive,
      rows,
    };
    return { ...preview, hash: digest(preview) };
  }
  async preview(body: unknown) {
    const dto = parseAwardInput(previewSchema, body);
    return this.db.transaction(async (em) => {
      await this.skills.lock(em);
      return this.previewWithin(em, dto.level_id, dto.member_ids);
    });
  }
  async record(body: unknown, assessor?: string) {
    const dto = parseAwardInput(awardSchema, body);
    const fingerprint = digest({ kind: 'award', ...dto });
    const created: Invoice[] = [];
    const result = await this.db.transaction(async (em) => {
      const club = this.tenant.getClubId();
      await this.skills.lock(em);
      const [saved] = await em.query(
        'SELECT fingerprint,result FROM award_requests WHERE club_id=$1 AND request_key=$2',
        [club, dto.request_key],
      );
      if (saved) {
        if (saved.fingerprint !== fingerprint)
          throw new ConflictException('Request key already used for different results');
        return saved.result;
      }
      if (
        !assessor ||
        !(
          await em.query(
            'SELECT user_id FROM users WHERE club_id=$1 AND user_id=$2 AND active=true',
            [club, assessor],
          )
        ).length
      )
        throw new NotFoundException('Assessor not found');
      const preview = await this.previewWithin(
        em,
        dto.level_id,
        dto.outcomes.map((o) => o.member_id),
      );
      if (dto.bill_fees) {
        const awardedIds = dto.outcomes
          .filter((o) => o.outcome === 'awarded')
          .map((o) => o.member_id);
        if (!awardedIds.length)
          throw new BadRequestException('Select an award before previewing fees');
        const fees = await this.previewWithin(em, dto.level_id, awardedIds);
        if (fees.hash !== dto.fee_preview_hash)
          throw new ConflictException(
            'Fees or family details changed. Review a fresh preview before billing.',
          );
      }
      const [event] = await em.query(
        'INSERT INTO award_assessment_events(club_id,level_id,assessed_at,assessed_by_user_id,notes) VALUES($1,$2,$3,$4,$5) RETURNING *',
        [club, dto.level_id, dto.assessed_at, assessor, dto.notes ?? null],
      );
      let awarded = 0;
      const warnings: string[] = [];
      for (const outcome of dto.outcomes) {
        const row = preview.rows.find((r) => r.member_id === outcome.member_id)!;
        let invoiceId = row.existing_invoice_id;
        if (outcome.outcome === 'awarded') {
          awarded++;
          if (dto.bill_fees && !row.reason) {
            const due = new Date(dto.assessed_at);
            due.setUTCDate(due.getUTCDate() + 14);
            const invoice = await this.invoices.createInTransaction(
              {
                family_id: row.family_id!,
                issued_date: dto.assessed_at,
                due_date: due.toISOString().slice(0, 10),
                notes: `${preview.level_name} for ${row.member_name}`,
                items: row.items,
              },
              em,
            );
            invoiceId = invoice.invoice_id;
            created.push(invoice);
            await em.query(
              'INSERT INTO award_invoice_sources(club_id,member_id,level_id,invoice_id) VALUES($1,$2,$3,$4)',
              [club, row.member_id, dto.level_id, invoiceId],
            );
          } else if (dto.bill_fees && row.reason === 'no_family')
            warnings.push(
              `${row.member_name}: award saved without a fee because no family is linked.`,
            );
        }
        await em.query(
          'INSERT INTO award_assessment_outcomes(club_id,event_id,member_id,outcome,notes,invoice_id) VALUES($1,$2,$3,$4,$5,$6)',
          [
            club,
            event.event_id,
            outcome.member_id,
            outcome.outcome,
            outcome.notes ?? null,
            invoiceId,
          ],
        );
        const status = outcome.outcome === 'not_yet' ? 'assessed' : outcome.outcome;
        await em.query(
          `INSERT INTO member_award_progress(club_id,member_id,level_id,status,assessed_on,awarded_on,notes,invoice_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
          ON CONFLICT(member_id,level_id) DO UPDATE SET status=CASE WHEN member_award_progress.status='awarded' THEN 'awarded' ELSE EXCLUDED.status END,
          assessed_on=EXCLUDED.assessed_on,awarded_on=COALESCE(member_award_progress.awarded_on,EXCLUDED.awarded_on),notes=EXCLUDED.notes,invoice_id=COALESCE(member_award_progress.invoice_id,EXCLUDED.invoice_id),updated_at=now()`,
          [
            club,
            outcome.member_id,
            dto.level_id,
            status,
            dto.assessed_at,
            status === 'awarded' ? dto.assessed_at : null,
            outcome.notes ?? null,
            invoiceId,
          ],
        );
      }
      const savedResult = {
        event: { ...event, assessed_at: dto.assessed_at } as AssessmentEvent,
        awarded,
        invoices_raised: created.length,
        warnings,
      };
      await em.query(
        'INSERT INTO award_requests(club_id,request_key,fingerprint,result) VALUES($1,$2,$3,$4::jsonb)',
        [club, dto.request_key, fingerprint, JSON.stringify(savedResult)],
      );
      return JSON.parse(JSON.stringify(savedResult));
    });
    // Only newly committed invoices are dispatched. Replays never dispatch again.
    // A process crash here leaves the invoice visible for normal finance recovery.
    for (const invoice of created) await this.invoices.dispatchCreated(invoice);
    return result;
  }
}
