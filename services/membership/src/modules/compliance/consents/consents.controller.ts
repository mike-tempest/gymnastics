import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ConsentsService } from './consents.service';
import { CreateConsentDto } from './dto/create-consent.dto';
import { UpdateConsentDto } from './dto/update-consent.dto';
import { ConsentType } from './entities/consent.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { UuidParam } from '../../../common/validation/parse-uuid.pipe';

@Controller('compliance/consents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConsentsController {
  constructor(private readonly consentsService: ConsentsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.PARENT)
  create(@Body() createDto: CreateConsentDto) {
    return this.consentsService.create(createDto);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  findAll() {
    return this.consentsService.findAll();
  }

  /**
   * The consent register: one row per member with the three required consents.
   * Same roles as the raw listing above, which the roles guard's coach-level
   * hierarchy already grants the Welfare Officer.
   */
  @Get('register')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  getRegister() {
    return this.consentsService.getRegister();
  }

  @Get('statistics')
  @Roles(UserRole.SUPER_ADMIN)
  getStatistics() {
    return this.consentsService.getStatistics();
  }

  @Get('pending')
  @Roles(UserRole.SUPER_ADMIN)
  getPendingConsents() {
    return this.consentsService.getPendingConsents();
  }

  @Get('expiring')
  @Roles(UserRole.SUPER_ADMIN)
  getExpiringConsents() {
    return this.consentsService.getExpiringConsents();
  }

  @Get('member/:memberId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH, UserRole.PARENT)
  findByMember(@Param('memberId', UuidParam) memberId: string) {
    return this.consentsService.findByMember(memberId);
  }

  @Get('member/:memberId/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH, UserRole.PARENT)
  getMemberConsentStatus(@Param('memberId', UuidParam) memberId: string) {
    return this.consentsService.getMemberConsentStatus(memberId);
  }

  @Get('member/:memberId/has/:consentType')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  async hasConsent(
    @Param('memberId', UuidParam) memberId: string,
    @Param('consentType') consentType: ConsentType,
  ) {
    const hasConsent = await this.consentsService.hasConsent(memberId, consentType);
    return {
      member_id: memberId,
      consent_type: consentType,
      has_consent: hasConsent,
    };
  }

  @Get('type/:consentType')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  findByType(@Param('consentType') consentType: ConsentType) {
    return this.consentsService.findByType(consentType);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH, UserRole.PARENT)
  findOne(@Param('id', UuidParam) id: string) {
    return this.consentsService.findOne(id);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PARENT)
  update(@Param('id', UuidParam) id: string, @Body() updateDto: UpdateConsentDto) {
    return this.consentsService.update(id, updateDto);
  }

  @Put(':id/revoke')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PARENT)
  revokeConsent(@Param('id', UuidParam) id: string, @Request() req: { user: { user_id: string } }) {
    return this.consentsService.revokeConsent(id, req.user.user_id);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  async remove(@Param('id', UuidParam) id: string) {
    await this.consentsService.remove(id);
    return { message: 'Consent deleted successfully' };
  }
}
