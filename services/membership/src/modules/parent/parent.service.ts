import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, Between, In, FindOptionsWhere } from 'typeorm';
import { Swimmer } from '../swimmers/entities/swimmer.entity';
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
import { UpdateParentProfileDto } from './dto/update-parent-profile.dto';
import { TenantScopedHelper } from '../../common/tenancy/tenant-scoped.helper';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

@Injectable()
export class ParentService {
  private readonly logger = new Logger(ParentService.name);

  constructor(
    @InjectRepository(Swimmer)
    private swimmersRepository: Repository<Swimmer>,
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
    @InjectRepository(CompetitionResult)
    private resultsRepository: Repository<CompetitionResult>,
    private readonly personalBests: PersonalBestsService,
    private goCardlessService: GoCardlessService,
    private readonly clubsRepository: ClubsRepository,
    private readonly scoped: TenantScopedHelper,
    private readonly tenantContext: TenantContextService,
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

    const swimmers = await this.scoped.scopedFind(this.swimmersRepository, {
      where: { family_id: familyId },
      relations: ['squad'],
    });

    return {
      family,
      swimmers,
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
    const childrenCount = await this.swimmersRepository.count({
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
      .andWhere('squad.squad_id IN (SELECT squad_id FROM swimmers WHERE family_id = :familyId)', {
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
    const children = await this.scoped.scopedFind(this.swimmersRepository, {
      where: { family_id: familyId },
      relations: ['squad', 'family'],
    });

    return children;
  }

  async getChild(familyId: string, childId: string) {
    const child = await this.scoped.scopedFindOne(this.swimmersRepository, {
      where: { swimmer_id: childId, family_id: familyId },
      relations: ['squad', 'family'],
    });

    if (!child) {
      throw new NotFoundException('Child not found or not associated with your family');
    }

    return child;
  }

  async getChildAttendance(familyId: string, childId: string, from?: string, to?: string) {
    // Verify child belongs to family (scoped to the active club).
    const child = await this.scoped.scopedFindOne(this.swimmersRepository, {
      where: { swimmer_id: childId, family_id: familyId },
    });

    if (!child) {
      throw new NotFoundException('Child not found or not associated with your family');
    }

    // Build query, pre-filtered to the active club.
    const query = this.scoped
      .scopedQueryBuilder(this.attendanceRepository, 'attendance')
      .leftJoinAndSelect('attendance.session', 'session')
      .leftJoinAndSelect('session.squad', 'squad')
      .andWhere('attendance.swimmer_id = :swimmerId', { swimmerId: childId });

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
    const child = await this.scoped.scopedFindOne(this.swimmersRepository, {
      where: { swimmer_id: childId, family_id: familyId },
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

  async getChildResults(familyId: string, childId: string) {
    // Verify child belongs to family (scoped to the active club).
    const child = await this.scoped.scopedFindOne(this.swimmersRepository, {
      where: { swimmer_id: childId, family_id: familyId },
    });

    if (!child) {
      throw new NotFoundException('Child not found or not associated with your family');
    }

    return await this.scoped.scopedFind(this.resultsRepository, {
      where: { swimmer_id: childId },
      relations: ['competition'],
      order: { created_at: 'DESC' },
    });
  }

  async getChildPersonalBests(familyId: string, childId: string) {
    // Verify child belongs to family (scoped to the active club).
    const child = await this.scoped.scopedFindOne(this.swimmersRepository, {
      where: { swimmer_id: childId, family_id: familyId },
    });

    if (!child) {
      throw new NotFoundException('Child not found or not associated with your family');
    }

    const [personalBests, seasonBests] = await Promise.all([
      this.personalBests.getForSwimmer(childId),
      this.personalBests.getSeasonBests(childId),
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
    // Get all swimmers for this family (scoped to the active club).
    const swimmers = await this.scoped.scopedFind(this.swimmersRepository, {
      where: { family_id: familyId },
      select: ['squad_id'],
    });

    const squadIds = swimmers.map((s) => s.squad_id).filter((id) => id !== null) as string[];

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
