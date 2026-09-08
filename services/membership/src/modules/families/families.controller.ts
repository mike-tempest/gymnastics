import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { FamiliesService } from './families.service';
import { CreateFamilyDto } from './dto/create-family.dto';
import { UpdateFamilyDto } from './dto/update-family.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { UserRole } from '../users/entities/user.entity';
import { UuidParam } from '../../common/validation/parse-uuid.pipe';

@Controller('families')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FamiliesController {
  constructor(private readonly familiesService: FamiliesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SUPER_ADMIN)
  create(@Body() createFamilyDto: CreateFamilyDto) {
    return this.familiesService.create(createFamilyDto);
  }

  @Get()
  findAll() {
    return this.familiesService.findAll();
  }

  @Get('statistics')
  getStatistics() {
    return this.familiesService.getStatistics();
  }

  // Invite endpoints must be defined before the :id route to avoid conflicts

  @Post('invite/accept')
  @HttpCode(HttpStatus.OK)
  @Public()
  acceptInvite(@Body() acceptInviteDto: AcceptInviteDto) {
    return this.familiesService.acceptInvite(acceptInviteDto.token, acceptInviteDto.userId);
  }

  @Get('invite/verify/:token')
  @Public()
  verifyInviteToken(@Param('token') token: string) {
    return this.familiesService.verifyInviteToken(token);
  }

  @Get(':id')
  findOne(@Param('id', UuidParam) id: string) {
    return this.familiesService.findOne(id);
  }

  @Post(':familyId/invite')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SUPER_ADMIN)
  generateInvite(@Param('familyId', UuidParam) familyId: string) {
    return this.familiesService.generateInvite(familyId);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  update(@Param('id', UuidParam) id: string, @Body() updateFamilyDto: UpdateFamilyDto) {
    return this.familiesService.update(id, updateFamilyDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.SUPER_ADMIN)
  remove(@Param('id', UuidParam) id: string) {
    return this.familiesService.remove(id);
  }
}
