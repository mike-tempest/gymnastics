import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, Between, In, FindOptionsWhere } from 'typeorm';
import { AwardProgressStatus } from '@club-manager/shared-types';
import { Member } from '../members/entities/member.entity';
import { Session } from '../sessions/entities/session.entity';
import { Invoice, InvoiceStatus } from '../finance/invoices/entities/invoice.entity';
import { Attendance } from '../attendance/entities/attendance.entity';
import { Family } from '../families/entities/family.entity';
import { Payment, PaymentMethod, PaymentStatus } from '../finance/payments/entities/payment.entity';
import {
  DirectDebitMandate,
  DirectDebitMandateStatus,
} from '../finance/mandates/entities/direct-debit-mandate.entity';
import { GoCardlessService } from '../gocardless/gocardless.service';
import { ClubsRepository } from '../clubs/clubs.repository';
import { CompetitionResult } from '../competitions/entities/competition-result.entity';
import { PersonalBestsService } from '../competitions/personal-bests.service';
import { AwardsService } from '../awards/awards.service';
import { UpdateParentProfileDto } from './dto/update-parent-profile.dto';
import { TenantScopedHelper } from '../../common/tenancy/tenant-scoped.helper';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

/** One badge on the ladder, with where this gymnast has got to on it. */
export interface ChildBadgeLevel {
  level_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  /** Null when the gymnast has not started this badge yet. */
  status: AwardProgressStatus | null;
  started_on: string | null;
  assessed_on: string | null;
  awarded_on: string | null;
}

/** One award scheme as a ladder of badges for a single gymnast. */
export interface ChildBadgeScheme {
  scheme_id: string;
  name: string;
  description: string | null;
  levels: ChildBadgeLevel[];
  awarded_count: number;
  /**
   * The badge this gymnast is on now: the lowest badge not yet awarded, so a
   * parent sees the next thing to look forward to rather than having to read
   * the whole ladder. Null only when every badge in the scheme is awarded.
   */
  current_level: ChildBadgeLevel | null;
  /** The most recent badge awarded in this scheme, if any. */
  latest_award: ChildBadgeLevel | null;
}

/** Every scheme's ladder for one gymnast, plus the club-wide headline. */
export interface ChildBadges {
  schemes: ChildBadgeScheme[];
  total_awarded: number;
  latest_award: (ChildBadgeLevel & { scheme_name: string }) | null;
}

@Injectable()
export class ParentService {
  private readonly logger = new Logger(ParentService.name);

  constructor(
    @InjectRepository(Member)
    private membersRepository: Repository<Member>,
    @InjectRepository(Session)
    private sessionsRepository: Repository<Session>,
    @InjectRepository(Invoice)
    private invoicesRepository: Repository<Invoice>,
    @InjectRepository(Attendance)
    private attendanceRepository: Repository<Attendance>,
    @InjectRepository(Family)
    private familyRepository: Repository<Family>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(DirectDebitMandate)
    private mandateRepository: Repository<DirectDebitMandate>,
    private goCardlessService: GoCardlessService,
    private readonly clubsRepository: ClubsRepository,
    private readonly scoped: TenantScopedHelper,
    private readonly tenantContext: TenantContextService,
    // Required, unlike the competitions dependencies below: badges are not
    // feature-flagged, so ParentModule always imports AwardsModule.
    private readonly awardsService: AwardsService,
    // Both competitions dependencies are absent when the competitions module
    // is flagged off (TEM-15): ParentModule then registers neither the entity
    // nor CompetitionsModule, and the results endpoints 404 via
    // CompetitionsEnabledGuard before reaching them. Declared last because
    // optional parameters cannot precede required ones.
    @Optional()
    @InjectRepository(CompetitionResult)
    private resultsRepository?: Repository<CompetitionResult>,
    @Optional()
    private readonly personalBests?: PersonalBestsService,
  ) {}

  async getProfile(familyId: string) {
    // Resolve the family by the authenticated user's family_id, scoped to the
    // active club so a parent can never read another club's family.
    const family = await this.scoped.scopedFindOne(this.familyRepository, {
      where: { family_id: familyId },
    });

    if (!family) {
      throw new NotFoundException('Family not found');
    }

    const members = await this.scoped.scopedFind(this.membersRepository, {
      where: { family_id: familyId },
      relations: ['squad'],
    });

    return {
      family,
      members,
    };
  }

  async updateProfile(familyId: string, dto: UpdateParentProfileDto): Promise<Family> {
    // Scope the affected-row predicate by club_id so a guessed family id from
    // another club cannot be mutated.
    await this.familyRepository.update(
      { family_id: familyId, club_id: this.tenantContext.getClubId() },
      dto,
    );
    const family = await this.scoped.scopedFindOne(this.familyRepository, {
      where: { family_id: familyId },
    });
    if (!family) {
      throw new NotFoundException('Family not found');
    }
    return family;
  }

  async getDashboard(familyId: string) {
    // Get children count
    const childrenCount = await this.membersRepository.count({
      where: { family_id: familyId, club_id: this.tenantContext.getClubId() },
    });

    // Get upcoming sessions (next 7 days)
    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(now.getDate() + 7);

    const upcomingSessions = await this.scoped
      .scopedQueryBuilder(this.sessionsRepository, 'session')
      .leftJoinAndSelect('session.squad', 'squad')
      .andWhere('session.session_date >= :now', { now })
      .andWhere('session.session_date <= :sevenDays', { sevenDays: sevenDaysFromNow })
      .andWhere('squad.squad_id IN (SELECT squad_id FROM members WHERE family_id = :familyId)', {
        familyId,
      })
      .orderBy('session.session_date', 'ASC')
      .getMany();

    // Get outstanding invoices
    const outstandingInvoices = await this.scoped.scopedFind(this.invoicesRepository, {
      where: {
        family_id: familyId,
        status: In(['pending', 'overdue']),
      },
      relations: ['items'],
      order: { due_date: 'ASC' },
    });

    // Calculate total outstanding
    const totalOutstanding = outstandingInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.total_amount),
      0,
    );

    return {
      childrenCount,
      upcomingSessions,
      outstandingInvoices,
      totalOutstanding,
    };
  }

  async getChildren(familyId: string) {
    const children = await this.scoped.scopedFind(this.membersRepository, {
      where: { family_id: familyId },
      relations: ['squad', 'family'],
    });

    return children;
  }

  async getChild(familyId: string, childId: string) {
    const child = await this.scoped.scopedFindOne(this.membersRepository, {
      where: { member_id: childId, family_id: familyId },
      relations: ['squad', 'family'],
    });

    if (!child) {
      throw new NotFoundException('Child not found or not associated with your family');
    }

    return child;
  }

  async getChildAttendance(familyId: string, childId: string, from?: string, to?: string) {
    // Verify child belongs to family (scoped to the active club).
    const child = await this.scoped.scopedFindOne(this.membersRepository, {
      where: { member_id: childId, family_id: familyId },
    });

    if (!child) {
      throw new NotFoundException('Child not found or not associated with your family');
    }

    // Build query, pre-filtered to the active club.
    const query = this.scoped
      .scopedQueryBuilder(this.attendanceRepository, 'attendance')
      .leftJoinAndSelect('attendance.session', 'session')
      .leftJoinAndSelect('session.squad', 'squad')
      .andWhere('attendance.member_id = :memberId', { memberId: childId });

    if (from) {
      query.andWhere('session.session_date >= :from', { from: new Date(from) });
    }

    if (to) {
      query.andWhere('session.session_date <= :to', { to: new Date(to) });
    }

    const attendance = await query.orderBy('session.session_date', 'DESC').getMany();

    return attendance;
  }

  async getChildSchedule(familyId: string, childId: string, days: number = 30) {
    // Verify child belongs to family (scoped to the active club).
    const child = await this.scoped.scopedFindOne(this.membersRepository, {
      where: { member_id: childId, family_id: familyId },
      relations: ['squad'],
    });

    if (!child) {
      throw new NotFoundException('Child not found or not associated with your family');
    }

    if (!child.squad_id) {
      return [];
    }

    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + days);

    const sessions = await this.scoped.scopedFind(this.sessionsRepository, {
      where: {
        squad_id: child.squad_id,
        session_date: Between(now, futureDate),
      },
      relations: ['squad'],
      order: { session_date: 'ASC' },
    });

    return sessions;
  }

  /**
   * The badge ladder for one of the calling parent's children.
   *
   * Reads the club's schemes and this gymnast's progress from the awards
   * module, then stitches them into one ladder per scheme so the portal can
   * show what has been earned, what is being worked towards and what comes
   * next without any further round trips.
   */
  async getChildBadges(familyId: string, childId: string): Promise<ChildBadges> {
    // Verify child belongs to family (scoped to the active club). Everything
    // below is club-scoped in turn, so a child id from another family or
    // another club is not-found rather than a leak.
    const child = await this.scoped.scopedFindOne(this.membersRepository, {
      where: { member_id: childId, family_id: familyId },
    });

    if (!child) {
      throw new NotFoundException('Child not found or not associated with your family');
    }

    // Inactive schemes and levels are fetched too, then filtered below: a club
    // that has retired a scheme must not erase badges a gymnast already holds.
    const [schemes, progressRows] = await Promise.all([
      this.awardsService.listSchemes(true),
      this.awardsService.getMemberProgress(childId),
    ]);

    const progressByLevel = new Map(progressRows.map((row) => [row.level_id, row]));

    const ladders: ChildBadgeScheme[] = [];
    for (const scheme of schemes) {
      const levels: ChildBadgeLevel[] = scheme.levels
        .filter((level) => level.active || progressByLevel.has(level.level_id))
        .map((level) => {
          const progress = progressByLevel.get(level.level_id);
          return {
            level_id: level.level_id,
            name: level.name,
            description: level.description,
            sort_order: level.sort_order,
            status: progress?.status ?? null,
            started_on: this.toDateString(progress?.started_on),
            assessed_on: this.toDateString(progress?.assessed_on),
            awarded_on: this.toDateString(progress?.awarded_on),
          };
        });

      const hasProgress = levels.some((level) => level.status !== null);
      // A scheme the club has switched off is only worth showing while this
      // gymnast still has something recorded against it.
      if (!scheme.active && !hasProgress) continue;
      if (levels.length === 0) continue;

      const awarded = levels.filter((level) => level.status === AwardProgressStatus.AWARDED);
      const latestAward = awarded.reduce<ChildBadgeLevel | null>(
        (latest, level) =>
          !latest || (level.awarded_on ?? '') > (latest.awarded_on ?? '') ? level : latest,
        null,
      );

      ladders.push({
        scheme_id: scheme.scheme_id,
        name: scheme.name,
        description: scheme.description,
        levels,
        awarded_count: awarded.length,
        current_level: levels.find((level) => level.status !== AwardProgressStatus.AWARDED) ?? null,
        latest_award: latestAward,
      });
    }

    const allAwards = ladders.flatMap((scheme) =>
      scheme.latest_award ? [{ ...scheme.latest_award, scheme_name: scheme.name }] : [],
    );
    const latestAward = allAwards.reduce<(ChildBadgeLevel & { scheme_name: string }) | null>(
      (latest, award) =>
        !latest || (award.awarded_on ?? '') > (latest.awarded_on ?? '') ? award : latest,
      null,
    );

    return {
      schemes: ladders,
      total_awarded: ladders.reduce((sum, scheme) => sum + scheme.awarded_count, 0),
      latest_award: latestAward,
    };
  }

  /**
   * Award dates are `date` columns, which the Postgres driver hands back as
   * YYYY-MM-DD strings but which the entity types as Date. Normalise both to
   * the date-only string the portal renders, so the response shape does not
   * depend on which the driver happens to give.
   */
  private toDateString(value: Date | string | null | undefined): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString().split('T')[0];
    return String(value).split('T')[0];
  }

  async getChildResults(familyId: string, childId: string) {
    // Defence in depth: the controller route already 404s via
    // CompetitionsEnabledGuard when the competitions module is off.
    if (!this.resultsRepository) {
      throw new NotFoundException();
    }

    // Verify child belongs to family (scoped to the active club).
    const child = await this.scoped.scopedFindOne(this.membersRepository, {
      where: { member_id: childId, family_id: familyId },
    });

    if (!child) {
      throw new NotFoundException('Child not found or not associated with your family');
    }

    return await this.scoped.scopedFind(this.resultsRepository, {
      where: { member_id: childId },
      relations: ['competition'],
      order: { created_at: 'DESC' },
    });
  }

  async getChildPersonalBests(familyId: string, childId: string) {
    // Defence in depth: the controller route already 404s via
    // CompetitionsEnabledGuard when the competitions module is off.
    const personalBestsService = this.personalBests;
    if (!personalBestsService) {
      throw new NotFoundException();
    }

    // Verify child belongs to family (scoped to the active club).
    const child = await this.scoped.scopedFindOne(this.membersRepository, {
      where: { member_id: childId, family_id: familyId },
    });

    if (!child) {
      throw new NotFoundException('Child not found or not associated with your family');
    }

    const [personalBests, seasonBests] = await Promise.all([
      personalBestsService.getForMember(childId),
      personalBestsService.getSeasonBests(childId),
    ]);

    return {
      personalBests,
      seasonBests: seasonBests.bests,
      seasonStart: seasonBests.seasonStart,
    };
  }

  async getInvoices(familyId: string, status?: string) {
    const where: FindOptionsWhere<Invoice> = { family_id: familyId };

    if (status) {
      where.status = status as InvoiceStatus;
    }

    const invoices = await this.scoped.scopedFind(this.invoicesRepository, {
      where,
      relations: ['items'],
      order: { issued_date: 'DESC' },
    });

    return invoices;
  }

  async getInvoice(familyId: string, invoiceId: string) {
    // The family relation is loaded for the bill-to details on the invoice
    // page and its PDF; the ownership check itself is the family_id predicate
    // combined with the club scope.
    const invoice = await this.scoped.scopedFindOne(this.invoicesRepository, {
      where: { invoice_id: invoiceId, family_id: familyId },
      relations: ['items', 'family'],
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found or not associated with your family');
    }

    return invoice;
  }

  async getPayments(familyId: string) {
    // Get all invoices for this family (scoped to the active club).
    const invoices = await this.scoped.scopedFind(this.invoicesRepository, {
      where: { family_id: familyId },
      select: ['invoice_id'],
    });

    const invoiceIds = invoices.map((inv) => inv.invoice_id);

    if (invoiceIds.length === 0) {
      return [];
    }

    // Get all payments for those invoices. Payments are also club-scoped, so a
    // crafted invoice id from another club cannot leak its payments.
    const payments = await this.scoped.scopedFind(this.paymentRepository, {
      where: { invoice_id: In(invoiceIds) },
      relations: ['invoice'],
      order: { payment_date: 'DESC' },
    });

    return payments;
  }

  async getUpcomingSessions(familyId: string) {
    // Get all members for this family (scoped to the active club).
    const members = await this.scoped.scopedFind(this.membersRepository, {
      where: { family_id: familyId },
      select: ['squad_id'],
    });

    const squadIds = members.map((s) => s.squad_id).filter((id) => id !== null) as string[];

    if (squadIds.length === 0) {
      return [];
    }

    // Get upcoming sessions for those squads
    const now = new Date();
    const sessions = await this.scoped.scopedFind(this.sessionsRepository, {
      where: {
        squad_id: In(squadIds),
        session_date: MoreThanOrEqual(now),
      },
      relations: ['squad'],
      order: { session_date: 'ASC', start_time: 'ASC' },
      take: 20, // Limit to next 20 sessions
    });

    return sessions;
  }

  async initiatePayment(familyId: string, invoiceId: string) {
    const invoice = await this.scoped.scopedFindOne(this.invoicesRepository, {
      where: { invoice_id: invoiceId, family_id: familyId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found or not associated with your family');
    }

    const mandate = await this.scoped.scopedFindOne(this.mandateRepository, {
      where: { family_id: familyId, status: DirectDebitMandateStatus.ACTIVE },
    });

    if (!mandate) {
      return {
        paymentId: null,
        status: 'no_mandate',
        redirectUrl: null,
        message: 'No active Direct Debit mandate found. Please set up a mandate first.',
      };
    }

    if (!this.goCardlessService.isConfigured()) {
      return {
        paymentId: null,
        status: 'not_configured',
        redirectUrl: null,
        message: 'Payment provider not configured. Please contact the club administrator.',
      };
    }

    // Charge in the currency the invoice was issued in, falling back to the
    // owning club's billing currency, then GBP, so a legacy invoice without a
    // stamped currency behaves exactly as before. An AU club's invoices are
    // stamped AUD at creation and are therefore collected in AUD.
    let currency = invoice.currency;
    if (!currency) {
      const club = await this.clubsRepository.findOne(this.tenantContext.getClubId());
      currency = club?.currency ?? 'GBP';
    }

    try {
      // This calls GoCardlessService directly because the parent pay endpoint
      // predates the PaymentProviderRegistry; the admin collect-invoice flow
      // (PaymentsService.collectDirectDebitPayment) routes through the
      // registry. Rerouting this path is deferred as it changes the response
      // contract (no_mandate / not_configured statuses) this endpoint exposes.
      const gcPayment = await this.goCardlessService.createPayment({
        amount: Number(invoice.total_amount),
        currency,
        mandateId: mandate.provider_mandate_id,
        description: `Invoice ${invoice.invoice_id}`,
        metadata: { invoice_id: invoice.invoice_id, family_id: familyId },
      });

      // Stamp club_id from the active tenant onto the new payment row.
      const payment = this.paymentRepository.create(
        this.scoped.stampCreate<Payment>({
          invoice_id: invoice.invoice_id,
          amount: Number(invoice.total_amount),
          currency,
          payment_date: new Date(),
          payment_method: PaymentMethod.DIRECT_DEBIT,
          status: PaymentStatus.PENDING_SUBMISSION,
          provider_payment_id: gcPayment.id,
        }),
      );

      const saved = await this.paymentRepository.save(payment);

      return {
        paymentId: saved.payment_id,
        status: 'initiated',
        redirectUrl: null,
        message: 'Payment initiated via Direct Debit',
      };
    } catch (error) {
      this.logger.error(`GoCardless payment failed for invoice ${invoiceId}`, error);
      return {
        paymentId: null,
        status: 'failed',
        redirectUrl: null,
        message: 'Payment initiation failed. Please try again later.',
      };
    }
  }
}
