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
  UseInterceptors,
  UploadedFile,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { CompetitionsService } from './competitions.service';
import { FileImportService } from './file-import.service';
import { FileExportService } from './file-export.service';
import { TimesImportService } from './times-import.service';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { UpdateCompetitionDto } from './dto/update-competition.dto';
import { CreateEntryDto } from './dto/create-entry.dto';
import { CreateResultDto } from './dto/create-result.dto';
import { UpdateResultDto } from './dto/update-result.dto';
import { FileFormat } from '../../parsers/parser.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('competitions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompetitionsController {
  constructor(
    private readonly competitionsService: CompetitionsService,
    private readonly fileImportService: FileImportService,
    private readonly fileExportService: FileExportService,
    private readonly timesImportService: TimesImportService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  create(@Body() dto: CreateCompetitionDto) {
    return this.competitionsService.create(dto);
  }

  @Get()
  findAll() {
    return this.competitionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.competitionsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  update(@Param('id') id: string, @Body() dto: UpdateCompetitionDto) {
    return this.competitionsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.competitionsService.remove(id);
  }

  @Get('swimmer/:swimmerId/results')
  getSwimmerResults(@Param('swimmerId') swimmerId: string) {
    return this.competitionsService.getSwimmerResults(swimmerId);
  }

  @Get('swimmer/:swimmerId/personal-bests')
  getSwimmerPersonalBests(@Param('swimmerId') swimmerId: string) {
    return this.competitionsService.getSwimmerPersonalBests(swimmerId);
  }

  // --- Entries ---

  @Post(':id/entries')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  addEntries(@Param('id') id: string, @Body() entries: CreateEntryDto[]) {
    return this.competitionsService.addEntries(id, entries);
  }

  @Get(':id/entries')
  getEntries(@Param('id') id: string) {
    return this.competitionsService.getEntries(id);
  }

  // --- Results ---

  @Get(':id/results')
  getResults(@Param('id') id: string) {
    return this.competitionsService.getResults(id);
  }

  @Post(':id/results')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  addResult(@Param('id') id: string, @Body() dto: CreateResultDto) {
    return this.competitionsService.addResult(id, dto);
  }

  @Patch(':id/results/:resultId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  updateResult(
    @Param('id') id: string,
    @Param('resultId') resultId: string,
    @Body() dto: UpdateResultDto,
  ) {
    return this.competitionsService.updateResult(id, resultId, dto);
  }

  @Delete(':id/results/:resultId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  removeResult(@Param('id') id: string, @Param('resultId') resultId: string) {
    return this.competitionsService.removeResult(id, resultId);
  }

  // --- File Import ---

  @Post(':id/import')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  @UseInterceptors(FileInterceptor('file'))
  async importResults(
    @Param('id') id: string,
    @UploadedFile() file: { buffer: Buffer; originalname: string },
    @Query('format') format?: string,
    @Query('preview') preview?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const fileContent = file.buffer.toString('utf-8');
    const fileName = file.originalname;
    const formatHint = format ? (format as FileFormat) : undefined;

    // Preview mode — parse and validate without saving
    if (preview === 'true') {
      return this.fileImportService.preview(id, fileName, fileContent, formatHint);
    }

    // Full import
    return this.fileImportService.importResults(id, fileName, fileContent, formatHint);
  }

  // --- CSV Times Import (baseline PBs, one row per swimmer per event) ---

  @Post(':id/import-times')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  @UseInterceptors(FileInterceptor('file'))
  async importTimes(
    @Param('id') id: string,
    @UploadedFile() file: { buffer: Buffer; originalname: string },
    @Query('preview') preview?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const csvContent = file.buffer.toString('utf-8');

    if (preview === 'true') {
      return this.timesImportService.preview(id, csvContent);
    }
    return this.timesImportService.import(id, csvContent);
  }

  // --- File Export ---

  @Post(':id/export')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HEAD_COACH)
  async exportEntries(
    @Param('id') id: string,
    @Query('format') format?: string,
    @Res() res?: Response,
  ) {
    const fileFormat = format === 'sportsystems' ? FileFormat.SPORTSYSTEMS : FileFormat.HY3;
    const { fileName, content } = await this.fileExportService.generateEntryFile(id, fileFormat);

    const contentType = fileFormat === FileFormat.HY3 ? 'application/octet-stream' : 'text/csv';

    res!.setHeader('Content-Type', contentType);
    res!.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res!.send(content);
  }
}
