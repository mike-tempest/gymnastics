import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength, Matches, ValidateBy } from 'class-validator';

export class ForgotPasswordDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  token: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  // bcrypt consumes at most 72 bytes, including multibyte characters.
  @ValidateBy({
    name: 'passwordBytes',
    validator: {
      validate: (value: unknown) =>
        typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= 72,
      defaultMessage: () => 'Password must be no more than 72 bytes',
    },
  })
  password: string;
}
