import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ClubStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
}

/**
 * Tenant root. Every tenant-owned table carries a club_id referencing this
 * table. One Club represents a single swim club sharing the database with
 * other clubs, isolated by row-level scoping.
 */
@Entity('clubs')
export class Club {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string;

  /** @deprecated Superseded by governing_body_region; kept for rollback safety. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  swim_england_region: string | null;

  /** @deprecated Superseded by affiliation_number; kept for rollback safety. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  swim_england_affiliate_number: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  county: string | null;

  /**
   * National governing body the club affiliates with (GoverningBody enum
   * value). Null means not set; Swim England is assumed for GB clubs with
   * legacy affiliation data (backfilled by migration 1744201700000).
   */
  @Column({ type: 'varchar', length: 40, nullable: true })
  governing_body: string | null;

  /** Region within the governing body (e.g. a Swim England region). */
  @Column({ type: 'varchar', length: 255, nullable: true })
  governing_body_region: string | null;

  /** The club's affiliation or membership number with its governing body. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  affiliation_number: string | null;

  /**
   * Percentage tax rate applied to invoices (e.g. 20.00 for UK VAT, 8.25 for
   * a US sales tax). Null means no tax, which preserves the previous
   * behaviour of tax_amount always being zero.
   */
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  tax_rate: number | null;

  /** Customer-facing name of the tax (VAT, Sales tax, GST, HST). */
  @Column({ type: 'varchar', length: 20, nullable: true })
  tax_label: string | null;

  /**
   * Whether the club's prices already include tax (the Australian GST
   * convention). When true, the line-item sum on an invoice is treated as the
   * gross total and the tax is backed out of it; when false, tax is added on
   * top of the subtotal. Defaults to false, preserving the added-on-top
   * behaviour for every existing club.
   */
  @Column({ type: 'boolean', default: false })
  tax_inclusive: boolean;

  /**
   * The club's tax registration identifier, rendered on tax invoices (ABN for
   * AU, VAT number for GB, GST/HST number for CA). Null means not registered
   * or not supplied, so invoices render exactly as before.
   */
  @Column({ type: 'varchar', length: 32, nullable: true })
  tax_registration_number: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contact_email: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  website: string | null;

  /**
   * ISO 3166-1 alpha-2 country code for the club (e.g. GB, US, CA, AU, IE).
   * Defaults to GB so existing UK clubs are unchanged.
   */
  @Column({ type: 'varchar', length: 2, default: 'GB' })
  country: string;

  /**
   * ISO 4217 currency code the club bills in (e.g. GBP, USD, CAD, AUD, EUR).
   * Defaults to GBP so existing UK clubs are unchanged.
   */
  @Column({ type: 'varchar', length: 3, default: 'GBP' })
  currency: string;

  /**
   * IANA timezone the club runs its sessions and billing in (e.g.
   * Europe/London, America/New_York). Defaults to Europe/London so existing
   * UK clubs are unchanged.
   */
  @Column({ type: 'varchar', length: 64, default: 'Europe/London' })
  timezone: string;

  /**
   * BCP 47 locale used for date and number formatting (e.g. en-GB, en-US).
   * Defaults to en-GB so existing UK clubs are unchanged.
   */
  @Column({ type: 'varchar', length: 10, default: 'en-GB' })
  locale: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: ClubStatus.ACTIVE,
  })
  status: ClubStatus;

  /**
   * Activation email sequence stamps. Non-null means that email was handled
   * for this club: either sent, or deliberately suppressed because the club
   * had already done the step it nudges towards. Used for idempotency by the
   * hourly activation cron.
   */
  @Column({ type: 'timestamptz', nullable: true })
  activation_day2_sent_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  activation_day5_sent_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  activation_day10_sent_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
