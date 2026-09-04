import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { IsEmail, IsString } from 'class-validator';
import { EmailService } from './email.service';

export class UnsubscribeDto {
  @IsEmail()
  email: string;

  @IsString()
  token: string;
}

/**
 * Public endpoint behind the unsubscribe links in marketing and nurture
 * email. Deliberately unauthenticated: recipients are usually not logged in.
 * The HMAC token proves the request came from a link we generated for that
 * address, so third parties cannot suppress arbitrary addresses.
 */
@Controller('unsubscribe')
export class UnsubscribeController {
  constructor(private readonly emailService: EmailService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async unsubscribe(@Body() dto: UnsubscribeDto): Promise<{ unsubscribed: boolean }> {
    if (!this.emailService.verifyUnsubscribeToken(dto.email, dto.token)) {
      throw new BadRequestException('Invalid unsubscribe link');
    }
    await this.emailService.suppress(dto.email);
    return { unsubscribed: true };
  }
}
