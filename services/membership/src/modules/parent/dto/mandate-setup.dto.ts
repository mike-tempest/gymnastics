import { IsNotEmpty, IsString, IsUrl, MaxLength } from 'class-validator';

/**
 * Parent-side Direct Debit setup. Neither DTO carries a family id: the family
 * comes from the caller's JWT, which is what makes these routes safe to expose
 * to parents at all.
 */
export class StartMandateSetupDto {
  /** Where the provider sends the parent back to once they have authorised. */
  @IsNotEmpty()
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  success_redirect_url: string;
}

export class CompleteMandateSetupDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  redirect_flow_id: string;

  /** The token minted by the start call. Verified, never trusted. */
  @IsNotEmpty()
  @IsString()
  @MaxLength(400)
  session_token: string;
}
