import { IsString, IsNotEmpty, IsOptional, IsUUID, IsBoolean } from 'class-validator';

/**
 * Rise Hub has no public API, so the bridge is a CSV in both directions. The
 * payload is the raw file contents; parsing stays server-side.
 */
export class RiseCsvImportDto {
  @IsNotEmpty()
  @IsString()
  csv: string;

  /**
   * Restricts matching of the scheme and level columns to one scheme. Without
   * it, a row's scheme column is matched by name across the club's schemes.
   */
  @IsOptional()
  @IsUUID()
  scheme_id?: string;

  /**
   * Raise badge invoices for rows that award a priced badge. Defaults to
   * false: a Rise export is usually a record of badges already handled, so an
   * import does not silently bill families unless asked to.
   */
  @IsOptional()
  @IsBoolean()
  bill_fees?: boolean;
}
