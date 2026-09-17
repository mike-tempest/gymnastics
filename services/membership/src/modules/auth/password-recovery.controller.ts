import { Body, Controller, Header, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from './decorators/public.decorator';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-recovery.dto';
import { PasswordRecoveryService } from './password-recovery.service';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class PasswordRecoveryController {
  constructor(private readonly recovery: PasswordRecoveryService) {}

  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  request(@Body() dto: ForgotPasswordDto) {
    return this.recovery.requestReset(dto.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  reset(@Body() dto: ResetPasswordDto) {
    return this.recovery.resetPassword(dto.token, dto.password);
  }
}
