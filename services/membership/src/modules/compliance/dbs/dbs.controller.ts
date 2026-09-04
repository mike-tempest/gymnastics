import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { DBSService } from './dbs.service';
import { CreateDBSCheckDto } from './dto/create-dbs-check.dto';
import { UpdateDBSCheckDto } from './dto/update-dbs-check.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';

@Controller('compliance/dbs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DBSController {
  constructor(private readonly dbsService: DBSService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  create(@Body() createDto: CreateDBSCheckDto, @Request() req: { user: { user_id: string } }) {
    return this.dbsService.create(createDto, req.user.user_id);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  findAll() {
    return this.dbsService.findAll();
  }

  @Get('statistics')
  @Roles(UserRole.SUPER_ADMIN)
  getStatistics() {
    return this.dbsService.getStatistics();
  }

  @Get('expiring-soon')
  @Roles(UserRole.SUPER_ADMIN)
  getExpiringSoon() {
    return this.dbsService.getExpiringSoon();
  }

  @Get('expired')
  @Roles(UserRole.SUPER_ADMIN)
  getExpired() {
    return this.dbsService.getExpired();
  }

  @Get('user/:userId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  findByUser(@Param('userId') userId: string) {
    return this.dbsService.findByUser(userId);
  }

  @Get('user/:userId/latest')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  getLatestForUser(@Param('userId') userId: string) {
    return this.dbsService.getLatestForUser(userId);
  }

  @Get('user/:userId/is-valid')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  async isUserValid(@Param('userId') userId: string) {
    const isValid = await this.dbsService.isUserDBSValid(userId);
    return { user_id: userId, is_dbs_valid: isValid };
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  findOne(@Param('id') id: string) {
    return this.dbsService.findOne(id);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN)
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateDBSCheckDto,
    @Request() req: { user: { user_id: string } },
  ) {
    return this.dbsService.update(id, updateDto, req.user.user_id);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  async remove(@Param('id') id: string) {
    await this.dbsService.remove(id);
    return { message: 'DBS check deleted successfully' };
  }
}
