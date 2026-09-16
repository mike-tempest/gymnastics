import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ExactRoles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { UuidParam } from '../../common/validation/parse-uuid.pipe';
import { EditOccurrenceDto, TimetableDto } from './dto/timetable.dto';
import { TimetableService } from './timetable.service';

@Controller('timetables')
@UseGuards(JwtAuthGuard, RolesGuard)
@ExactRoles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
export class TimetableController {
  constructor(private readonly timetables: TimetableService) {}
  @Get() list() {
    return this.timetables.list();
  }
  @Post('preview') preview(@Body() dto: TimetableDto) {
    return this.timetables.preview(dto);
  }
  @Post() commit(@Body() dto: TimetableDto) {
    return this.timetables.commit(dto);
  }
  @Patch('occurrences/:id') edit(
    @Param('id', UuidParam) id: string,
    @Body() dto: EditOccurrenceDto,
  ) {
    return this.timetables.edit(id, dto);
  }
}
