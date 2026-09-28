import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AwardSkillsService } from './award-skills.service';
import { AwardBillingService } from './award-billing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ExactRoles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { OptionalUuidParam, UuidParam } from '../../common/validation/parse-uuid.pipe';
const ASSESS = [UserRole.SUPER_ADMIN, UserRole.HEAD_COACH, UserRole.SQUAD_COACH];
@Controller('awards')
@UseGuards(JwtAuthGuard, RolesGuard)
@ExactRoles(...ASSESS)
export class AwardSkillsController {
  constructor(
    private readonly skills: AwardSkillsService,
    private readonly billing: AwardBillingService,
  ) {}
  @Get('levels/:levelId/criteria')
  criteria(@Param('levelId', UuidParam) id: string) {
    return this.skills.criteria(id);
  }
  @Post('levels/:levelId/criteria')
  @ExactRoles(UserRole.SUPER_ADMIN)
  create(@Param('levelId', UuidParam) id: string, @Body() body: unknown) {
    return this.skills.createCriterion(id, body);
  }
  @Patch('criteria/:criterionId')
  @ExactRoles(UserRole.SUPER_ADMIN)
  update(@Param('criterionId', UuidParam) id: string, @Body() body: unknown) {
    return this.skills.updateCriterion(id, body);
  }
  @Patch('levels/:levelId/progression')
  @ExactRoles(UserRole.SUPER_ADMIN)
  progression(@Param('levelId', UuidParam) id: string, @Body() body: unknown) {
    return this.skills.setProgression(id, body);
  }
  @Get('skills/context')
  context(
    @Query('level_id', UuidParam) id: string,
    @Query('session_id', OptionalUuidParam) session?: string,
    @Query('squad_id', OptionalUuidParam) squad?: string,
  ) {
    return this.skills.assessmentContext(id, session, squad);
  }
  @Post('skills/assessments')
  assess(@Body() body: unknown, @Request() req: { user: { user_id: string } }) {
    return this.skills.assess(body, req.user.user_id);
  }
  @Get('skills/history/:memberId/:levelId')
  history(
    @Param('memberId', UuidParam) member: string,
    @Param('levelId', UuidParam) level: string,
  ) {
    return this.skills.history(member, level);
  }
  @Post('fees/preview')
  preview(@Body() body: unknown) {
    return this.billing.preview(body);
  }
}
