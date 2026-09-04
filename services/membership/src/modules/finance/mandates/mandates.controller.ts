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
import { MandatesService } from './mandates.service';
import { CreateMandateDto } from './dto/create-mandate.dto';
import { UpdateMandateDto } from './dto/update-mandate.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';

@Controller('mandates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MandatesController {
  constructor(private readonly mandatesService: MandatesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SUPER_ADMIN)
  create(@Body() createMandateDto: CreateMandateDto) {
    return this.mandatesService.create(createMandateDto);
  }

  @Get()
  findAll() {
    return this.mandatesService.findAll();
  }

  @Get('family/:familyId')
  findByFamily(@Param('familyId') familyId: string) {
    return this.mandatesService.findByFamily(familyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.mandatesService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() updateMandateDto: UpdateMandateDto) {
    return this.mandatesService.update(id, updateMandateDto);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.SUPER_ADMIN)
  cancel(@Param('id') id: string) {
    return this.mandatesService.cancel(id);
  }

  @Patch(':id/sync')
  @Roles(UserRole.SUPER_ADMIN)
  syncStatus(@Param('id') id: string) {
    return this.mandatesService.syncMandateStatus(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.mandatesService.remove(id);
  }

  @Post('setup/start')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SUPER_ADMIN)
  createRedirectFlow(
    @Body() body: { family_id: string; session_token: string; success_redirect_url: string },
  ) {
    return this.mandatesService.createRedirectFlow(
      body.family_id,
      body.session_token,
      body.success_redirect_url,
    );
  }

  @Post('setup/complete')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SUPER_ADMIN)
  completeRedirectFlow(
    @Body() body: { redirect_flow_id: string; session_token: string; family_id: string },
  ) {
    return this.mandatesService.completeRedirectFlow(
      body.redirect_flow_id,
      body.session_token,
      body.family_id,
    );
  }
}
