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
  Query,
  BadRequestException,
} from '@nestjs/common';
import { isDiscipline, isSquadType } from '@club-manager/shared-types';
import { SquadsService } from './squads.service';
import { CreateSquadDto } from './dto/create-squad.dto';
import { UpdateSquadDto } from './dto/update-squad.dto';
import { BulkCreateSquadDto } from './dto/bulk-create-squad.dto';
import { AssignMemberDto } from './dto/assign-member.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { UuidParam } from '../../common/validation/parse-uuid.pipe';

@Controller('squads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SquadsController {
  constructor(private readonly squadsService: SquadsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  create(@Body() createSquadDto: CreateSquadDto) {
    return this.squadsService.create(createSquadDto);
  }

  @Post('bulk')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  bulkCreate(@Body() bulkCreateDto: BulkCreateSquadDto) {
    return this.squadsService.bulkCreate(bulkCreateDto.squads);
  }

  /**
   * GET /squads?type=&discipline=
   *
   * Both filters are optional and compose. As with members, the club comes
   * from the tenant context and these filters can only narrow within it.
   */
  @Get()
  findAll(@Query('type') type?: string, @Query('discipline') discipline?: string) {
    if (type !== undefined && type !== '' && !isSquadType(type)) {
      throw new BadRequestException(`Unknown squad type "${type}"`);
    }
    if (discipline !== undefined && discipline !== '' && !isDiscipline(discipline)) {
      throw new BadRequestException(`Unknown discipline "${discipline}"`);
    }

    return this.squadsService.findAll({
      type: isSquadType(type) ? type : undefined,
      discipline: isDiscipline(discipline) ? discipline : undefined,
    });
  }

  @Get('statistics')
  getStatistics() {
    return this.squadsService.getStatistics();
  }

  @Get(':id')
  findOne(@Param('id', UuidParam) id: string) {
    return this.squadsService.findOne(id);
  }

  @Get(':id/members')
  getMembers(@Param('id', UuidParam) id: string) {
    return this.squadsService.getMembersBySquad(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  update(@Param('id', UuidParam) id: string, @Body() updateSquadDto: UpdateSquadDto) {
    return this.squadsService.update(id, updateSquadDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.SUPER_ADMIN)
  remove(@Param('id', UuidParam) id: string) {
    return this.squadsService.remove(id);
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  assignMember(@Param('id', UuidParam) id: string, @Body() assignMemberDto: AssignMemberDto) {
    return this.squadsService.assignMember(id, assignMemberDto.member_id);
  }

  @Delete(':id/members/:memberId')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  removeMember(@Param('id', UuidParam) id: string, @Param('memberId', UuidParam) memberId: string) {
    return this.squadsService.removeMember(id, memberId);
  }
}
