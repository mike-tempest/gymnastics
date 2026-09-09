import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CredentialsService } from './credentials.service';
import { CreateCredentialDto } from './dto/create-credential.dto';
import { UpdateCredentialDto } from './dto/update-credential.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ExactRoles, Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { UuidParam } from '../../../common/validation/parse-uuid.pipe';

/**
 * Credential records are safeguarding evidence, so the welfare officer reads
 * and writes them alongside the club admin. Head coaches can see who is in
 * date without being able to change the record.
 */
@Controller('compliance/credentials')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CredentialsController {
  constructor(private readonly credentialsService: CredentialsService) {}

  @Post()
  @ExactRoles(UserRole.SUPER_ADMIN, UserRole.TREASURER, UserRole.WELFARE_OFFICER)
  create(@Body() createDto: CreateCredentialDto, @Request() req: { user: { user_id: string } }) {
    return this.credentialsService.create(createDto, req.user.user_id);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.WELFARE_OFFICER, UserRole.HEAD_COACH)
  findAll() {
    return this.credentialsService.findAll();
  }

  @Get('statistics')
  @Roles(UserRole.SUPER_ADMIN, UserRole.WELFARE_OFFICER, UserRole.HEAD_COACH)
  getStatistics() {
    return this.credentialsService.getStatistics();
  }

  @Get('expiring-soon')
  @Roles(UserRole.SUPER_ADMIN, UserRole.WELFARE_OFFICER, UserRole.HEAD_COACH)
  getExpiringSoon() {
    return this.credentialsService.getExpiringSoon();
  }

  @Get('expired')
  @Roles(UserRole.SUPER_ADMIN, UserRole.WELFARE_OFFICER, UserRole.HEAD_COACH)
  getExpired() {
    return this.credentialsService.getExpired();
  }

  @Get('user/:userId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.WELFARE_OFFICER, UserRole.HEAD_COACH)
  findByUser(@Param('userId', UuidParam) userId: string) {
    return this.credentialsService.findByUser(userId);
  }

  @Get('member/:memberId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.WELFARE_OFFICER, UserRole.HEAD_COACH)
  findByMember(@Param('memberId', UuidParam) memberId: string) {
    return this.credentialsService.findByMember(memberId);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.WELFARE_OFFICER, UserRole.HEAD_COACH)
  findOne(@Param('id', UuidParam) id: string) {
    return this.credentialsService.findOne(id);
  }

  @Put(':id')
  @ExactRoles(UserRole.SUPER_ADMIN, UserRole.TREASURER, UserRole.WELFARE_OFFICER)
  update(@Param('id', UuidParam) id: string, @Body() updateDto: UpdateCredentialDto) {
    return this.credentialsService.update(id, updateDto);
  }

  @Delete(':id')
  @ExactRoles(UserRole.SUPER_ADMIN, UserRole.TREASURER, UserRole.WELFARE_OFFICER)
  async remove(@Param('id', UuidParam) id: string) {
    await this.credentialsService.remove(id);
    return { message: 'Credential deleted successfully' };
  }
}
