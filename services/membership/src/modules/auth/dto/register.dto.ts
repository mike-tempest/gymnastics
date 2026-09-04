import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  first_name: string;

  @IsString()
  last_name: string;

  /**
   * Role as sent by the web app. Accepts the coarse frontend labels
   * (`PARENT` / `COACH` / `ADMIN`) as well as raw `UserRole` enum values; the
   * AuthService maps this to the lowercase enum via `mapRole`. Kept as a plain
   * string so the global ValidationPipe does not reject the uppercase labels
   * before the mapping runs.
   */
  @IsString()
  @IsOptional()
  role?: string;

  @IsString()
  @IsOptional()
  family_id?: string;
}
