import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsEnum, IsString, Length } from 'class-validator';
import { ALL_API_KEY_SCOPES, ApiKeyScope } from '@club-manager/shared-types';

/**
 * What an admin supplies when minting a read API key.
 *
 * There is nothing here about the credential itself: the secret is generated
 * server side from a CSPRNG and can never be chosen or influenced by the
 * caller.
 */
export class CreateApiKeyDto {
  /** Human label, so a club can tell its keys apart a year later. */
  @IsString()
  @Length(1, 120)
  label: string;

  /**
   * Read scopes to grant. At least one, and capped at the number of scopes
   * that actually exist so the column cannot be stuffed with repeats.
   */
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(ALL_API_KEY_SCOPES.length)
  @IsEnum(ApiKeyScope, { each: true })
  scopes: ApiKeyScope[];
}
