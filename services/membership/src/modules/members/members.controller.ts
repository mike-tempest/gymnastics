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
} from '@nestjs/common';
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

  @Get()
  findAll(@Query('family_id') familyId?: string, @Query('squad_id') squadId?: string) {
    // Note: any `?club_id=` query param is intentionally ignored. The club is
    // always taken from the authenticated tenant context, so a caller cannot
    // request another club's members by supplying its id. findAll() and all
    // other reads below are already scoped to the active club.
    if (familyId) {
      return this.membersService.findByFamilyId(familyId);
    }
    if (squadId) {
      return this.membersService.findBySquadId(squadId);
    }
    return this.membersService.findAll();
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
