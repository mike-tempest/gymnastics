import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { isDiscipline } from '@club-manager/shared-types';
import { MembersService } from './members.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { BulkCreateMemberDto } from './dto/bulk-create-member.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('members')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  create(@Body() createMemberDto: CreateMemberDto) {
    return this.membersService.create(createMemberDto);
  }

  @Post('bulk')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  bulkCreate(@Body() bulkCreateDto: BulkCreateMemberDto) {
    return this.membersService.bulkCreate(bulkCreateDto.members);
  }

  /**
   * GET /members?family_id=&squad_id=&discipline=
   *
   * The filters compose rather than taking one branch each, so a request can
   * ask for a single discipline within a single squad.
   *
   * Note: any `?club_id=` query param is intentionally ignored. The club is
   * always taken from the authenticated tenant context, so a caller cannot
   * request another club's members by supplying its id. Every read below is
   * already scoped to the active club, and these filters only narrow further.
   */
  @Get()
  findAll(
    @Query('family_id') familyId?: string,
    @Query('squad_id') squadId?: string,
    @Query('discipline') discipline?: string,
  ) {
    if (discipline !== undefined && discipline !== '' && !isDiscipline(discipline)) {
      throw new BadRequestException(`Unknown discipline "${discipline}"`);
    }

    return this.membersService.findAll({
      familyId: familyId || undefined,
      squadId: squadId || undefined,
      discipline: isDiscipline(discipline) ? discipline : undefined,
    });
  }

  @Get('statistics')
  getStatistics() {
    return this.membersService.getStatistics();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.membersService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  update(@Param('id') id: string, @Body() updateMemberDto: UpdateMemberDto) {
    return this.membersService.update(id, updateMemberDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.membersService.remove(id);
  }
}
