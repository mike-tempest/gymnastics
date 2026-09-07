import { IsString, IsNotEmpty, IsOptional, IsUUID, IsBoolean, MaxLength } from 'class-validator';

/**
 * Largest CSV this endpoint accepts, in characters.
 *
 * The service bootstrap leaves the JSON body parser at its default, so a
 * request larger than that is rejected before it reaches this DTO and the club
 * sees only a generic failure. Bounding the field here keeps a large file
 * inside a message that says what to do about it. Raising the service-wide
 * body limit is a cross-cutting change and belongs in its own piece of work.
 */
const MAX_RISE_CSV_CHARS = 90_000;

/**
 * Rise Hub has no public API, so the bridge is a CSV in both directions. The
 * payload is the raw file contents; parsing stays server-side.
 */
export class RiseCsvImportDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(MAX_RISE_CSV_CHARS, {
    message:
      'That file is too large to import in one go. Please split it into smaller files and import them one at a time.',
  })
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
