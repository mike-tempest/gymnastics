import { Controller, Post, Body, Query, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { DataImportService } from './data-import.service';
import { GoCardlessTakeoverService } from './gocardless-takeover.service';
import { ImportMembersDto } from './dto/import-members.dto';
import { ImportGoCardlessDto } from './dto/import-gocardless.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('import')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DataImportController {
  constructor(
    private readonly dataImportService: DataImportService,
    private readonly goCardlessTakeoverService: GoCardlessTakeoverService,
  ) {}

  /**
   * Combined members import: members plus their parent/family details in one
   * payload. With ?preview=true the request is a dry run that persists nothing.
   */
  @Post('members')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN)
  importMembers(@Body() importMembersDto: ImportMembersDto, @Query('preview') preview?: string) {
    if (preview === 'true') {
      return this.dataImportService.previewMembers(importMembersDto);
    }
    return this.dataImportService.importMembers(importMembersDto);
  }

  /**
   * GoCardless organisation takeover from the club's own dashboard CSV exports
   * (customers, mandates and optionally payments), so a migrating club keeps
   * every live Direct Debit instead of re-mandating its parents. With
   * ?preview=true the request is a dry run that persists nothing.
   */
  @Post('gocardless')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN)
  importGoCardless(
    @Body() importGoCardlessDto: ImportGoCardlessDto,
    @Query('preview') preview?: string,
  ) {
    if (preview === 'true') {
      return this.goCardlessTakeoverService.previewGoCardless(importGoCardlessDto);
    }
    return this.goCardlessTakeoverService.importGoCardless(importGoCardlessDto);
  }
}
