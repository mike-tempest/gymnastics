import { EntityTarget, ObjectLiteral } from 'typeorm';

import { Attendance } from '../attendance/entities/attendance.entity';
import { AssessmentEvent, AssessmentOutcome } from '../awards/entities/assessment-event.entity';
import { AwardLevel } from '../awards/entities/award-level.entity';
import { AwardScheme } from '../awards/entities/award-scheme.entity';
import { MemberAwardProgress } from '../awards/entities/member-award-progress.entity';
import { ClubSettings } from '../admin/settings/club-settings.entity';
import { Communication } from '../communications/entities/communication.entity';
import { Consent } from '../compliance/consents/entities/consent.entity';
import { DBSCheck } from '../compliance/dbs/entities/dbs-check.entity';
import { ChecklistItem } from '../compliance/safeguarding/entities/checklist-item.entity';
import { Incident } from '../compliance/safeguarding/entities/incident.entity';
import { SafeguardingOfficer } from '../compliance/safeguarding/entities/safeguarding-officer.entity';
import { Family } from '../families/entities/family.entity';
import { FamilyInvite } from '../families/entities/family-invite.entity';
import { FeeStructure } from '../finance/fee-structures/entities/fee-structure.entity';
import { Invoice } from '../finance/invoices/entities/invoice.entity';
import { InvoiceItem } from '../finance/invoices/entities/invoice-item.entity';
import { DirectDebitMandate } from '../finance/mandates/entities/direct-debit-mandate.entity';
import { Payment } from '../finance/payments/entities/payment.entity';
import { Member } from '../members/entities/member.entity';
import { Session } from '../sessions/entities/session.entity';
import { Squad } from '../squads/entities/squad.entity';
import { User } from '../users/entities/user.entity';
import { WaitingListEntry } from '../waiting-list/entities/waiting-list-entry.entity';
import { WaitingListOffer } from '../waiting-list/entities/waiting-list-offer.entity';
import { WaitingListSettings } from '../waiting-list/entities/waiting-list-settings.entity';

/** One CSV inside the export ZIP. */
export interface ExportFileSpec {
  /** Name of the file inside the archive. */
  filename: string;
  /** Entity whose rows the file holds. */
  entity: EntityTarget<ObjectLiteral>;
  /** One line describing the file, written into README.txt. */
  description: string;
  /**
   * Columns never written, because they are credentials or single-use secrets
   * rather than the club's data. They are not selected from the database at
   * all, so they cannot reach the archive by accident.
   */
  omit?: readonly string[];
}

/**
 * Every table the full club export writes, in the order the files are listed
 * in README.txt: who the club is, then who trains there, then what they were
 * billed, then what the club has to prove for compliance.
 *
 * Two tables in the archive are not in this list, because neither can be read
 * through TenantScopedHelper and each needs its own query: `clubs`, which is
 * the tenant root and has no `club_id` column, and `squad_members`, the squad
 * roster join table, which is scoped through its squad. The service builds
 * both by hand (see ExportService.buildClubCsv and buildSquadMembersCsv).
 *
 * Deliberately absent, and stated in README.txt so a club is never misled
 * about what it has been handed:
 *
 *  - `wellbeing_logs` and `cycle_logs`. Health and menstrual-cycle records
 *    that a gymnast enters for herself. A club-wide dump of them is a product
 *    decision about who may read that data, not a default.
 *  - The competitions module (`modules/competitions`), which is the swimming
 *    times and strokes feature and is feature-flagged off (TEM-15).
 *  - `modules/waitlist`, which is the product's marketing launch list rather
 *    than club data. The club's own waiting list is `waiting_list_*` below.
 *  - `audit_logs`, an operational access trail rather than club records, and
 *    large enough to swamp everything else in the archive.
 *  - `email_suppressions`, which is keyed by email address alone and holds no
 *    `club_id`, so it is not one club's data to take.
 *  - `club_payment_connections`, which holds provider account state rather
 *    than club records, and belongs to the payment provider's own dashboard.
 */
export const EXPORT_FILES: readonly ExportFileSpec[] = [
  {
    filename: 'club-settings.csv',
    entity: ClubSettings,
    description: "The club's own settings: contact details, locations, billing and notifications.",
  },
  {
    filename: 'users.csv',
    entity: User,
    description: 'Staff and parent logins, with their roles. Passwords are never exported.',
    omit: ['password_hash'],
  },
  {
    filename: 'families.csv',
    entity: Family,
    description: 'Families and their primary contact and address details.',
    omit: ['invite_token'],
  },
  {
    filename: 'members.csv',
    entity: Member,
    description: 'Every gymnast on the books, including medical notes and emergency contacts.',
  },
  {
    filename: 'family-invites.csv',
    entity: FamilyInvite,
    description:
      'Invitations sent to families to claim their account. Single-use links are not exported.',
    omit: ['token'],
  },
  {
    filename: 'squads.csv',
    entity: Squad,
    description: 'Squads and recreational classes, with their levels and disciplines.',
  },
  {
    filename: 'sessions.csv',
    entity: Session,
    description: 'Scheduled and past sessions.',
  },
  {
    filename: 'attendance.csv',
    entity: Attendance,
    description: 'Every register mark, keyed by session and gymnast.',
  },
  {
    filename: 'fee-structures.csv',
    entity: FeeStructure,
    description: 'Fee structures the club bills from.',
  },
  {
    filename: 'invoices.csv',
    entity: Invoice,
    description: 'Invoices raised, with their status and totals.',
  },
  {
    filename: 'invoice-items.csv',
    entity: InvoiceItem,
    description: 'The individual lines on each invoice.',
  },
  {
    filename: 'payments.csv',
    entity: Payment,
    description: 'Payments recorded against invoices.',
  },
  {
    filename: 'direct-debit-mandates.csv',
    entity: DirectDebitMandate,
    description: 'Direct Debit mandates, with the provider-side identifiers the club owns.',
  },
  {
    filename: 'award-schemes.csv',
    entity: AwardScheme,
    description: 'Award schemes, such as British Gymnastics Rise or a club scheme.',
  },
  {
    filename: 'award-levels.csv',
    entity: AwardLevel,
    description: 'The badges and levels within each scheme.',
  },
  {
    filename: 'member-award-progress.csv',
    entity: MemberAwardProgress,
    description: 'Where each gymnast has reached in each scheme.',
  },
  {
    filename: 'assessment-events.csv',
    entity: AssessmentEvent,
    description: 'Badge assessment sessions run by the club.',
  },
  {
    filename: 'assessment-outcomes.csv',
    entity: AssessmentOutcome,
    description: 'The result recorded for each gymnast at each assessment.',
  },
  {
    filename: 'consents.csv',
    entity: Consent,
    description: 'Photography, data-sharing and other consents, with their current status.',
  },
  {
    filename: 'dbs-checks.csv',
    entity: DBSCheck,
    description: 'Background checks (DBS, PVG, AccessNI) and their expiry dates.',
  },
  {
    filename: 'safeguarding-officers.csv',
    entity: SafeguardingOfficer,
    description: 'Welfare Officers and other safeguarding roles.',
  },
  {
    filename: 'safeguarding-incidents.csv',
    entity: Incident,
    description: 'Safeguarding incidents logged by the club.',
  },
  {
    filename: 'safeguarding-checklist.csv',
    entity: ChecklistItem,
    description: "The club's safeguarding checklist and where it stands.",
  },
  {
    filename: 'waiting-list-settings.csv',
    entity: WaitingListSettings,
    description: 'How the club runs its waiting list: auto-offer and the acceptance window.',
  },
  {
    filename: 'waiting-list-entries.csv',
    entity: WaitingListEntry,
    description: "Everyone on the club's waiting list.",
  },
  {
    filename: 'waiting-list-offers.csv',
    entity: WaitingListOffer,
    description: 'Places offered off the waiting list. Single-use accept links are not exported.',
    omit: ['accept_token'],
  },
  {
    filename: 'communications.csv',
    entity: Communication,
    description: 'Emails and messages the club has sent.',
  },
];
