import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { WaitingListOfferStatus } from '@club-manager/shared-types';
import { CLS_CLUB_ID_KEY } from '../../common/tenancy/tenant-context.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ClubsRepository } from '../clubs/clubs.repository';
import { SquadsRepository } from '../squads/squads.repository';
import { UserRole } from '../users/entities/user.entity';
import {
  CreateWaitingListEntryDto,
  JoinWaitingListDto,
  ListWaitingListQueryDto,
  UpdateWaitingListEntryDto,
  WithdrawWaitingListEntryDto,
} from './dto/waiting-list-entry.dto';
import {
  CreateOfferDto,
  DeclineOfferDto,
  EnrolFromWaitingListDto,
  UpdateWaitingListSettingsDto,
} from './dto/waiting-list-offer.dto';
import { WaitingListOffersService } from './waiting-list-offers.service';
import { WaitingListRepository } from './waiting-list.repository';
import { WaitingListService } from './waiting-list.service';

/** Roles that can see the list. Offers and enrolment are admin-only. */
const READ_ROLES = [UserRole.SUPER_ADMIN, UserRole.HEAD_COACH, UserRole.TREASURER] as const;

/** Roles that can run the list: offer places, enrol, change the settings. */
const MANAGE_ROLES = [UserRole.SUPER_ADMIN, UserRole.HEAD_COACH] as const;

/**
 * The club's waiting list (TEM-22).
 *
 * Mounted at /waiting-list, deliberately distinct from /waitlist, which is the
 * product's own launch waiting list and has nothing to do with this.
 *
 * The four public routes carry no authentication at all: a family joins the
 * list without an account, and answers an offer from a link in an email. The
 * club is resolved from the slug in the path (join) or from the offer the
 * random token identifies (accept and decline), and the tenant context is set
 * from that resolved club before anything club-scoped runs.
 */
@Controller('waiting-list')
@UseGuards(JwtAuthGuard)
export class WaitingListController {
  constructor(
    private readonly waitingListService: WaitingListService,
    private readonly offersService: WaitingListOffersService,
    private readonly repository: WaitingListRepository,
    private readonly clubsRepository: ClubsRepository,
    private readonly squadsRepository: SquadsRepository,
    private readonly cls: ClsService,
  ) {}

  // ==================== Public: joining and answering ====================

  /**
   * What the public join page needs to render: the club's name and the classes
   * a family can ask for by name.
   */
  @Get('public/:clubSlug')
  @Public()
  async publicClubDetails(@Param('clubSlug') clubSlug: string) {
    const club = await this.clubsRepository.findBySlug(clubSlug);
    if (!club) {
      throw new NotFoundException('Club not found');
    }
    this.cls.set(CLS_CLUB_ID_KEY, club.id);
    const squads = await this.squadsRepository.findAllNames();
    const detail = await this.squadsRepository.findAllClassifications();
    const byId = new Map(detail.map((squad) => [squad.squad_id, squad]));

    return {
      club_name: club.name,
      club_slug: club.slug,
      squads: squads.map((squad) => ({
        squad_id: squad.squad_id,
        squad_name: squad.squad_name,
        squad_type: byId.get(squad.squad_id)?.squad_type ?? null,
        discipline: byId.get(squad.squad_id)?.discipline ?? null,
      })),
    };
  }

  @Post('join/:clubSlug')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  join(@Param('clubSlug') clubSlug: string, @Body() dto: JoinWaitingListDto) {
    return this.waitingListService.joinByClubSlug(clubSlug, dto);
  }

  /** What is behind an offer link, for the page the parent lands on. */
  @Get('offers/token/:token')
  @Public()
  async viewOffer(@Param('token') token: string) {
    const offer = await this.repository.findOfferByTokenAcrossClubs(token);
    if (!offer) {
      throw new NotFoundException('This offer link is not valid. It may already have been used.');
    }
    const club = await this.clubsRepository.findOne(offer.club_id);
    return {
      offer_id: offer.offer_id,
      status: offer.status,
      expires_at: offer.expires_at,
      club_name: club?.name ?? null,
      squad_name: offer.squad?.squad_name ?? null,
      training_times: offer.squad?.training_times ?? null,
      child_name: offer.entry
        ? `${offer.entry.child_first_name} ${offer.entry.child_last_name}`
        : null,
      expired: new Date(offer.expires_at).getTime() < Date.now(),
    };
  }

  @Post('offers/token/:token/accept')
  @Public()
  @HttpCode(HttpStatus.OK)
  async acceptOffer(@Param('token') token: string) {
    const offer = await this.resolvePublicOffer(token);
    const result = await this.offersService.accept(offer);
    // The parent has no business seeing the club's internal ids or the list of
    // things an administrator still has to tidy up.
    return {
      enrolled: true,
      squad_assigned: result.squad_assigned,
      invite_url: result.invite_url,
      mandate_setup_required: !result.mandate_already_active,
    };
  }

  @Post('offers/token/:token/decline')
  @Public()
  @HttpCode(HttpStatus.OK)
  async declineOffer(@Param('token') token: string, @Body() dto: DeclineOfferDto) {
    const offer = await this.resolvePublicOffer(token);
    await this.offersService.decline(offer, dto.reason);
    return { declined: true };
  }

  /**
   * Resolves an offer from its public token and adopts that offer's club as
   * the tenant for the rest of the request. The token is a 64-character
   * random secret that identifies exactly one offer, so it is the credential;
   * an expired window is refused here rather than deeper in.
   */
  private async resolvePublicOffer(token: string) {
    const offer = await this.repository.findOfferByTokenAcrossClubs(token);
    if (!offer) {
      throw new NotFoundException('This offer link is not valid. It may already have been used.');
    }
    this.cls.set(CLS_CLUB_ID_KEY, offer.club_id);
    if (offer.status !== WaitingListOfferStatus.PENDING) {
      throw new BadRequestException(`This offer has already been ${offer.status}.`);
    }
    if (new Date(offer.expires_at).getTime() < Date.now()) {
      throw new BadRequestException(
        'This offer has run out of time and the place has gone to the next family. ' +
          'Please contact the club.',
      );
    }
    return offer;
  }

  // ==================== Admin: the list ====================

  @Get()
  @UseGuards(RolesGuard)
  @Roles(...READ_ROLES)
  list(@Query() query: ListWaitingListQueryDto) {
    return this.waitingListService.list({
      status: query.status,
      discipline: query.discipline,
      squadType: query.squad_type,
    });
  }

  @Get('summary')
  @UseGuards(RolesGuard)
  @Roles(...READ_ROLES)
  summary() {
    return this.waitingListService.summary();
  }

  @Get('settings')
  @UseGuards(RolesGuard)
  @Roles(...READ_ROLES)
  getSettings() {
    return this.waitingListService.getSettings();
  }

  @Put('settings')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  updateSettings(@Body() dto: UpdateWaitingListSettingsDto) {
    return this.waitingListService.updateSettings(dto);
  }

  /** Live offers, for the offer management screen. */
  @Get('offers')
  @UseGuards(RolesGuard)
  @Roles(...READ_ROLES)
  listOffers(@Query('status') status?: string) {
    const statuses = status
      ? (status.split(',').filter(isOfferStatus) as WaitingListOfferStatus[])
      : [WaitingListOfferStatus.PENDING];
    return this.repository.findOffers(statuses);
  }

  @Post('offers/:offerId/withdraw')
  @UseGuards(RolesGuard)
  @Roles(...MANAGE_ROLES)
  @HttpCode(HttpStatus.OK)
  async withdrawOffer(@Param('offerId') offerId: string) {
    await this.offersService.withdraw(offerId);
    return { withdrawn: true };
  }

  @Post('entries')
  @UseGuards(RolesGuard)
  @Roles(...MANAGE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  createEntry(@Body() dto: CreateWaitingListEntryDto) {
    return this.waitingListService.createEntry(dto);
  }

  @Get('entries/:entryId')
  @UseGuards(RolesGuard)
  @Roles(...READ_ROLES)
  getEntry(@Param('entryId') entryId: string) {
    return this.waitingListService.findOne(entryId);
  }

  @Patch('entries/:entryId')
  @UseGuards(RolesGuard)
  @Roles(...MANAGE_ROLES)
  updateEntry(@Param('entryId') entryId: string, @Body() dto: UpdateWaitingListEntryDto) {
    return this.waitingListService.updateEntry(entryId, dto);
  }

  @Post('entries/:entryId/withdraw')
  @UseGuards(RolesGuard)
  @Roles(...MANAGE_ROLES)
  @HttpCode(HttpStatus.OK)
  withdrawEntry(@Param('entryId') entryId: string, @Body() dto: WithdrawWaitingListEntryDto) {
    return this.waitingListService.withdrawEntry(entryId, dto.reason);
  }

  /** The manual fallback: the club chooses who is offered which place. */
  @Post('entries/:entryId/offer')
  @UseGuards(RolesGuard)
  @Roles(...MANAGE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  offerPlace(@Param('entryId') entryId: string, @Body() dto: CreateOfferDto) {
    return this.offersService.offerManually(entryId, dto.squad_id, dto.expires_in_days);
  }

  /** One click: waiting list to enrolled, billed member. */
  @Post('entries/:entryId/enrol')
  @UseGuards(RolesGuard)
  @Roles(...MANAGE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  enrol(@Param('entryId') entryId: string, @Body() dto: EnrolFromWaitingListDto) {
    return this.waitingListService.enrolEntry(entryId, dto.squad_id ?? null);
  }
}

function isOfferStatus(value: string): value is WaitingListOfferStatus {
  return (Object.values(WaitingListOfferStatus) as string[]).includes(value);
}
