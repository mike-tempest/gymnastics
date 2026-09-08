import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Header,
  HttpCode,
  HttpStatus,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AwardsService } from './awards.service';
import { CreateAwardSchemeDto, UpdateAwardSchemeDto } from './dto/award-scheme.dto';
import { CreateAwardLevelDto, UpdateAwardLevelDto } from './dto/award-level.dto';
import { RecordAssessmentDto, SetProgressDto } from './dto/record-assessment.dto';
import { RiseCsvImportDto } from './dto/rise-csv.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import {
  OptionalUuidParam,
  UuidListParam,
  UuidParam,
} from '../../common/validation/parse-uuid.pipe';

/** Roles allowed to read the badge catalogue and progress. */
const READ_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.HEAD_COACH,
  UserRole.SQUAD_COACH,
  UserRole.TREASURER,
] as const;

/** Roles allowed to assess and award badges. */
const ASSESS_ROLES = [UserRole.SUPER_ADMIN, UserRole.HEAD_COACH, UserRole.SQUAD_COACH] as const;

interface AuthenticatedRequest {
  user?: { user_id?: string };
}

@Controller('awards')
@UseGuards(JwtAuthGuard)
export class AwardsController {
  constructor(private readonly awardsService: AwardsService) {}

  // --- Schemes: admin manages the catalogue, coaches read it ---

  @Get('schemes')
  @UseGuards(RolesGuard)
  @Roles(...READ_ROLES)
  listSchemes(@Query('include_inactive') includeInactive?: string) {
    return this.awardsService.listSchemes(includeInactive === 'true');
  }

  @Get('schemes/:schemeId')
  @UseGuards(RolesGuard)
  @Roles(...READ_ROLES)
  getScheme(@Param('schemeId', UuidParam) schemeId: string) {
    return this.awardsService.getScheme(schemeId);
  }

  @Post('schemes')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  createScheme(@Body() dto: CreateAwardSchemeDto) {
    return this.awardsService.createScheme(dto);
  }

  /**
   * Installs the starter schemes (British Gymnastics Rise and the legacy
   * Proficiency Awards) as ordinary editable rows in this club's database.
   */
  @Post('schemes/install-defaults')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  installDefaults() {
    return this.awardsService.installDefaultSchemes();
  }

  @Patch('schemes/:schemeId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  updateScheme(@Param('schemeId', UuidParam) schemeId: string, @Body() dto: UpdateAwardSchemeDto) {
    return this.awardsService.updateScheme(schemeId, dto);
  }

  @Delete('schemes/:schemeId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeScheme(@Param('schemeId', UuidParam) schemeId: string) {
    return this.awardsService.removeScheme(schemeId);
  }

  // --- Levels ---

  @Post('levels')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  createLevel(@Body() dto: CreateAwardLevelDto) {
    return this.awardsService.createLevel(dto);
  }

  @Patch('levels/:levelId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  updateLevel(@Param('levelId', UuidParam) levelId: string, @Body() dto: UpdateAwardLevelDto) {
    return this.awardsService.updateLevel(levelId, dto);
  }

  @Delete('levels/:levelId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeLevel(@Param('levelId', UuidParam) levelId: string) {
    return this.awardsService.removeLevel(levelId);
  }

  // --- Progress ---

  @Get('member/:memberId/progress')
  @UseGuards(RolesGuard)
  @Roles(...READ_ROLES)
  getMemberProgress(@Param('memberId', UuidParam) memberId: string) {
    return this.awardsService.getMemberProgress(memberId);
  }

  @Get('progress')
  @UseGuards(RolesGuard)
  @Roles(...READ_ROLES)
  getProgressForMembers(@Query('member_ids', UuidListParam) memberIds: string[]) {
    return this.awardsService.getProgressForMembers(memberIds);
  }

  @Post('progress')
  @UseGuards(RolesGuard)
  @Roles(...ASSESS_ROLES)
  @HttpCode(HttpStatus.CREATED)
  setProgress(@Body() dto: SetProgressDto) {
    return this.awardsService.setProgress(dto);
  }

  // --- Assessment ---

  @Post('assessments')
  @UseGuards(RolesGuard)
  @Roles(...ASSESS_ROLES)
  @HttpCode(HttpStatus.CREATED)
  recordAssessment(@Body() dto: RecordAssessmentDto, @Request() req: AuthenticatedRequest) {
    return this.awardsService.recordAssessment(dto, req.user?.user_id);
  }

  @Get('assessments')
  @UseGuards(RolesGuard)
  @Roles(...READ_ROLES)
  listAssessments(
    @Query('level_id', OptionalUuidParam) levelId?: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Number(limit) : undefined;
    return this.awardsService.listEvents(
      levelId,
      Number.isFinite(parsed) && parsed! > 0 ? parsed : undefined,
    );
  }

  @Get('assessments/:eventId')
  @UseGuards(RolesGuard)
  @Roles(...READ_ROLES)
  getAssessment(@Param('eventId', UuidParam) eventId: string) {
    return this.awardsService.getEvent(eventId);
  }

  // --- Rise CSV bridge ---

  @Get('export/rise.csv')
  @UseGuards(RolesGuard)
  @Roles(...READ_ROLES)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="rise-awards.csv"')
  exportRiseCsv(
    @Query('scheme_id', OptionalUuidParam) schemeId?: string,
    @Query('include_assessed') includeAssessed?: string,
  ) {
    return this.awardsService.exportRiseCsv({
      schemeId,
      includeAssessed: includeAssessed === 'true',
    });
  }

  @Post('import/rise/preview')
  @UseGuards(RolesGuard)
  @Roles(...ASSESS_ROLES)
  @HttpCode(HttpStatus.OK)
  previewRiseImport(@Body() dto: RiseCsvImportDto) {
    return this.awardsService.previewRiseImport(dto);
  }

  @Post('import/rise')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  importRiseCsv(@Body() dto: RiseCsvImportDto) {
    return this.awardsService.importRiseCsv(dto);
  }
}
