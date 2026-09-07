import { IsString, IsNotEmpty, IsOptional, IsEmail, MaxLength } from 'class-validator';

/**
 * Rows parsed from a club's own GoCardless dashboard CSV exports.
 *
 * The takeover is deliberately built on the dashboard exports rather than the
 * GoCardless API: Partner OAuth (which would let this platform read a club's
 * organisation directly) does not exist for us yet, and the club can download
 * customers.csv, mandates.csv and payments.csv today without giving anyone
 * API credentials. Column names below follow those exports.
 */

/** One row of the GoCardless customers export. */
export class GoCardlessCustomerRowDto {
  /** GoCardless customer id, e.g. CU0001234. */
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  id: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  given_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  family_name?: string;

  /** Set instead of given/family name when the payer is an organisation. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  company_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address_line1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address_line2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postal_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  created_at?: string;
}

/** One row of the GoCardless mandates export. */
export class GoCardlessMandateRowDto {
  /** GoCardless mandate id, e.g. MD0001234. */
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  id: string;

  /** GoCardless customer id this mandate belongs to (the export's links column). */
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  customer: string;

  /**
   * GoCardless mandate status verbatim from the export (active, submitted,
   * cancelled, expired, failed, pending_submission, pending_customer_approval).
   */
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  status: string;

  /** Bank-debit scheme, e.g. bacs. Defaults to bacs when the export omits it. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  scheme?: string;

  /** The payer-visible mandate reference. Recorded for reconciliation only. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  created_at?: string;
}

/**
 * One row of the GoCardless payments export.
 *
 * Payments are read for reconciliation reporting only and are never written:
 * see GoCardlessTakeoverService for why.
 */
export class GoCardlessPaymentRowDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  id: string;

  /** GoCardless mandate id this payment was collected against. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  mandate?: string;

  /** Amount exactly as exported, as a string so no precision is lost in transit. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  amount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  charge_date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
