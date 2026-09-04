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
import { AttendanceService } from './attendance.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  create(@Body() createAttendanceDto: CreateAttendanceDto) {
    return this.attendanceService.create(createAttendanceDto);
  }

  @Post('bulk')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  markAttendance(@Body() body: { session_id: string } & MarkAttendanceDto) {
    const { session_id, ...markAttendanceDto } = body;
    return this.attendanceService.markAttendance(session_id, markAttendanceDto);
  }

  @Post('check-in')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  checkIn(@Body() body: { session_id: string; swimmer_id: string }) {
    return this.attendanceService.checkInSwimmer(body.session_id, body.swimmer_id);
  }

  @Get()
  findAll() {
    return this.attendanceService.findAll();
  }

  @Get('session/:sessionId')
  getSessionAttendance(@Param('sessionId') sessionId: string) {
    return this.attendanceService.getSessionAttendance(sessionId);
  }

  @Get('swimmer/:swimmerId')
  getSwimmerAttendance(@Param('swimmerId') swimmerId: string) {
    return this.attendanceService.getSwimmerAttendance(swimmerId);
  }

  @Get('swimmer/:swimmerId/stats')
  getSwimmerStats(@Param('swimmerId') swimmerId: string) {
    return this.attendanceService.getSwimmerAttendanceStats(swimmerId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.attendanceService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  update(@Param('id') id: string, @Body() updateAttendanceDto: UpdateAttendanceDto) {
    return this.attendanceService.update(id, updateAttendanceDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  remove(@Param('id') id: string) {
    return this.attendanceService.remove(id);
  }
}
