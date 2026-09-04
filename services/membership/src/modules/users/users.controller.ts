import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { BulkCreateStaffDto } from './dto/bulk-create-staff.dto';
import { UserRole } from './entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.TREASURER)
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Post('bulk')
  @Roles(UserRole.SUPER_ADMIN)
  bulkCreateStaff(@Body() bulkCreateStaffDto: BulkCreateStaffDto) {
    return this.usersService.bulkCreateStaff(bulkCreateStaffDto.users);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.TREASURER)
  findAll() {
    return this.usersService.findAll();
  }

  @Get('role/:role')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TREASURER)
  findByRole(@Param('role') role: UserRole) {
    return this.usersService.findByRole(role);
  }

  @Get('family/:familyId')
  findByFamily(@Param('familyId') familyId: string) {
    return this.usersService.findByFamily(familyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TREASURER)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
