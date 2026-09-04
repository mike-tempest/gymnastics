import {
  Controller,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { DataImportService } from './data-import.service';
import { ImportMembersDto } from './dto/import-members.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('import')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DataImportController {
  constructor(private readonly dataImportService: DataImportService) {}

  /**
   * Combined members import: swimmers plus their parent/family details in one
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
}
