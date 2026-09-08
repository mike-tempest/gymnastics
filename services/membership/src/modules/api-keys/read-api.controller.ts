import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiKeyScope } from '@club-manager/shared-types';
import { OptionalUuidParam, UuidParam } from '../../common/validation/parse-uuid.pipe';
import { MembersService } from '../members/members.service';
import { FamiliesService } from '../families/families.service';
import { SquadsService } from '../squads/squads.service';
import { SessionsService } from '../sessions/sessions.service';
import { AttendanceService } from '../attendance/attendance.service';
import { InvoicesService } from '../finance/invoices/invoices.service';
import { MandatesService } from '../finance/mandates/mandates.service';
import { AwardsService } from '../awards/awards.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ReadOnlyApiGuard } from './guards/read-only.guard';
import { ApiKeyScopesGuard } from './guards/api-key-scopes.guard';
import { ApiKeyScopes } from './decorators/api-key-scopes.decorator';
import { API_KEY_SECURITY_SCHEME } from './openapi.constants';
import {
  ApiAttendanceDto,
  ApiAwardProgressDto,
  ApiAwardSchemeDto,
  ApiFamilyDto,
  ApiInvoiceDto,
  ApiMandateDto,
  ApiMemberDto,
  ApiSessionDto,
  ApiSquadDto,
} from './dto/read-api.dto';
import {
  toApiAttendance,
  toApiAttendanceFromRoster,
  toApiAwardProgress,
  toApiAwardScheme,
  toApiFamily,
  toApiInvoice,
  toApiMandate,
  toApiMember,
  toApiSession,
  toApiSquad,
} from './read-api.mapper';

/**
 * The club read API (TEM-32).
 *
 * A club owns its data and must be able to read it out on its own terms. This
 * is the whole of the surface an API key can reach, and every handler here is
 * a @Get. That is the primary read-only enforcement: there is no mutating
 * route for a key to find. ReadOnlyApiGuard behind it refuses a non-read verb
 * anyway, so adding a @Post here later fails loudly rather than quietly
 * opening a write path.
 *
 * Tenancy is not this controller's business, and that is deliberate. Every
 * service it calls is already scoped through TenantScopedHelper, and
 * ApiKeyGuard has put the key's club into exactly the CLS slot those services
 * read. A key therefore sees precisely what a user of that club would, and
 * nothing else, through the same code path that is already covered by the
 * tenant-isolation suites.
 *
 * Mounted under /api/public/v1, so the published contract is versioned
 * separately from the internal routes the web app uses and can be evolved
 * without either one dragging the other along.
 */
@ApiTags('Club read API')
@ApiSecurity(API_KEY_SECURITY_SCHEME)
@ApiUnauthorizedResponse({ description: 'The API key is missing, unknown or revoked.' })
@ApiForbiddenResponse({ description: 'The API key does not grant the scope this route needs.' })
@Controller('public/v1')
@UseGuards(ApiKeyGuard, ReadOnlyApiGuard, ApiKeyScopesGuard)
export class ReadApiController {
  constructor(
    private readonly membersService: MembersService,
    private readonly familiesService: FamiliesService,
    private readonly squadsService: SquadsService,
    private readonly sessionsService: SessionsService,
    private readonly attendanceService: AttendanceService,
    private readonly invoicesService: InvoicesService,
    private readonly mandatesService: MandatesService,
    private readonly awardsService: AwardsService,
  ) {}

  // --- Members ---

  @Get('members')
  @ApiKeyScopes(ApiKeyScope.MEMBERS_READ)
  @ApiOperation({
    summary: 'List gymnasts',
    description:
      'Every gymnast registered to the club. Medical notes and emergency contacts are ' +
      'deliberately not included; use the full club export for those.',
  })
  @ApiQuery({ name: 'squad_id', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'family_id', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: [ApiMemberDto] })
  async listMembers(
    @Query('squad_id', OptionalUuidParam) squadId?: string,
    @Query('family_id', OptionalUuidParam) familyId?: string,
  ): Promise<ApiMemberDto[]> {
    const members = await this.membersService.findAll({ squadId, familyId });
    return members.map(toApiMember);
  }

  @Get('members/:memberId')
  @ApiKeyScopes(ApiKeyScope.MEMBERS_READ)
  @ApiOperation({ summary: 'Fetch one gymnast' })
  @ApiParam({ name: 'memberId', format: 'uuid' })
  @ApiOkResponse({ type: ApiMemberDto })
  async getMember(@Param('memberId', UuidParam) memberId: string): Promise<ApiMemberDto> {
    return toApiMember(await this.membersService.findOne(memberId));
  }

  // --- Families ---

  @Get('families')
  @ApiKeyScopes(ApiKeyScope.FAMILIES_READ)
  @ApiOperation({ summary: 'List families and their primary contact details' })
  @ApiOkResponse({ type: [ApiFamilyDto] })
  async listFamilies(): Promise<ApiFamilyDto[]> {
    const families = await this.familiesService.findAll();
    return families.map(toApiFamily);
  }

  @Get('families/:familyId')
  @ApiKeyScopes(ApiKeyScope.FAMILIES_READ)
  @ApiOperation({ summary: 'Fetch one family' })
  @ApiParam({ name: 'familyId', format: 'uuid' })
  @ApiOkResponse({ type: ApiFamilyDto })
  async getFamily(@Param('familyId', UuidParam) familyId: string): Promise<ApiFamilyDto> {
    return toApiFamily(await this.familiesService.findOne(familyId));
  }

  // --- Squads ---

  @Get('squads')
  @ApiKeyScopes(ApiKeyScope.SQUADS_READ)
  @ApiOperation({ summary: 'List squads, with current member counts' })
  @ApiOkResponse({ type: [ApiSquadDto] })
  async listSquads(): Promise<ApiSquadDto[]> {
    const squads = await this.squadsService.findAll();
    return squads.map(toApiSquad);
  }

  @Get('squads/:squadId')
  @ApiKeyScopes(ApiKeyScope.SQUADS_READ)
  @ApiOperation({ summary: 'Fetch one squad' })
  @ApiParam({ name: 'squadId', format: 'uuid' })
  @ApiOkResponse({ type: ApiSquadDto })
  async getSquad(@Param('squadId', UuidParam) squadId: string): Promise<ApiSquadDto> {
    return toApiSquad(await this.squadsService.findOne(squadId));
  }

  // --- Sessions ---

  @Get('sessions')
  @ApiKeyScopes(ApiKeyScope.SESSIONS_READ)
  @ApiOperation({ summary: 'List training sessions' })
  @ApiQuery({ name: 'squad_id', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: [ApiSessionDto] })
  async listSessions(
    @Query('squad_id', OptionalUuidParam) squadId?: string,
  ): Promise<ApiSessionDto[]> {
    const sessions = squadId
      ? await this.sessionsService.getSessionsBySquad(squadId)
      : await this.sessionsService.findAll();
    return sessions.map(toApiSession);
  }

  @Get('sessions/:sessionId')
  @ApiKeyScopes(ApiKeyScope.SESSIONS_READ)
  @ApiOperation({ summary: 'Fetch one session' })
  @ApiParam({ name: 'sessionId', format: 'uuid' })
  @ApiOkResponse({ type: ApiSessionDto })
  async getSession(@Param('sessionId', UuidParam) sessionId: string): Promise<ApiSessionDto> {
    return toApiSession(await this.sessionsService.findOne(sessionId));
  }

  // --- Attendance ---

  @Get('attendance')
  @ApiKeyScopes(ApiKeyScope.ATTENDANCE_READ)
  @ApiOperation({
    summary: 'List attendance records',
    description:
      'Filter by session or by gymnast. Without a filter this returns the club whole ' +
      'attendance history, which for an established club is a large response.',
  })
  @ApiQuery({ name: 'session_id', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'member_id', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: [ApiAttendanceDto] })
  async listAttendance(
    @Query('session_id', OptionalUuidParam) sessionId?: string,
    @Query('member_id', OptionalUuidParam) memberId?: string,
  ): Promise<ApiAttendanceDto[]> {
    if (sessionId) {
      // The roster includes gymnasts who were never marked, which the register
      // needs but which is not an attendance record. The mapper returns null
      // for those and they are dropped here, so the API publishes rows only.
      const roster = await this.attendanceService.getSessionRoster(sessionId);
      return roster
        .map(toApiAttendanceFromRoster)
        .filter((entry): entry is ApiAttendanceDto => entry !== null);
    }

    const records = memberId
      ? await this.attendanceService.getMemberAttendance(memberId)
      : await this.attendanceService.findAll();
    return records.map(toApiAttendance);
  }

  // --- Invoices ---

  @Get('invoices')
  @ApiKeyScopes(ApiKeyScope.INVOICES_READ)
  @ApiOperation({ summary: 'List invoices' })
  @ApiQuery({ name: 'family_id', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: [ApiInvoiceDto] })
  async listInvoices(
    @Query('family_id', OptionalUuidParam) familyId?: string,
  ): Promise<ApiInvoiceDto[]> {
    const invoices = familyId
      ? await this.invoicesService.findByFamily(familyId)
      : await this.invoicesService.findAll();
    return invoices.map(toApiInvoice);
  }

  @Get('invoices/:invoiceId')
  @ApiKeyScopes(ApiKeyScope.INVOICES_READ)
  @ApiOperation({ summary: 'Fetch one invoice' })
  @ApiParam({ name: 'invoiceId', format: 'uuid' })
  @ApiOkResponse({ type: ApiInvoiceDto })
  async getInvoice(@Param('invoiceId', UuidParam) invoiceId: string): Promise<ApiInvoiceDto> {
    return toApiInvoice(await this.invoicesService.findOne(invoiceId));
  }

  // --- Direct debit mandates ---

  @Get('mandates')
  @ApiKeyScopes(ApiKeyScope.MANDATES_READ)
  @ApiOperation({
    summary: 'List direct debit mandates',
    description:
      'Mandate status per family. Provider-side identifiers are not included, so a ' +
      'leaked read key cannot be used against the payment provider directly.',
  })
  @ApiQuery({ name: 'family_id', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: [ApiMandateDto] })
  async listMandates(
    @Query('family_id', OptionalUuidParam) familyId?: string,
  ): Promise<ApiMandateDto[]> {
    const mandates = familyId
      ? await this.mandatesService.findByFamily(familyId)
      : await this.mandatesService.findAll();
    return mandates.map(toApiMandate);
  }

  // --- Awards ---

  @Get('award-schemes')
  @ApiKeyScopes(ApiKeyScope.AWARDS_READ)
  @ApiOperation({
    summary: 'List award schemes and their levels',
    description:
      'Schemes are data, so this returns whatever the club runs: BG Rise, the legacy ' +
      'Proficiency Awards, or its own badges.',
  })
  @ApiOkResponse({ type: [ApiAwardSchemeDto] })
  async listAwardSchemes(): Promise<ApiAwardSchemeDto[]> {
    const schemes = await this.awardsService.listSchemes();
    return schemes.map(toApiAwardScheme);
  }

  @Get('members/:memberId/award-progress')
  @ApiKeyScopes(ApiKeyScope.AWARDS_READ)
  @ApiOperation({ summary: 'Award progress for one gymnast' })
  @ApiParam({ name: 'memberId', format: 'uuid' })
  @ApiOkResponse({ type: [ApiAwardProgressDto] })
  async getMemberAwardProgress(
    @Param('memberId', UuidParam) memberId: string,
  ): Promise<ApiAwardProgressDto[]> {
    const progress = await this.awardsService.getMemberProgress(memberId);
    return progress.map(toApiAwardProgress);
  }
}
