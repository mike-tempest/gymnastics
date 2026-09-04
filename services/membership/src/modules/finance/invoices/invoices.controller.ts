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
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { InvoicesService } from './invoices.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { GenerateInvoicesDto } from './dto/generate-invoices.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoiceStatus } from './entities/invoice.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly invoicePdfService: InvoicePdfService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SUPER_ADMIN)
  create(@Body() createInvoiceDto: CreateInvoiceDto) {
    return this.invoicesService.create(createInvoiceDto);
  }

  @Post('generate-monthly')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SUPER_ADMIN)
  generateMonthly(@Query('squad_id') squadId?: string) {
    return this.invoicesService.generateMonthlyInvoices(squadId);
  }

  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SUPER_ADMIN)
  generate(@Body() generateInvoicesDto: GenerateInvoicesDto) {
    return this.invoicesService.generateInvoicesForFeeStructure(
      generateInvoicesDto.fee_structure_id,
      generateInvoicesDto.billing_period,
    );
  }

  @Post(':id/send-reminder')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN)
  sendReminder(@Param('id') id: string) {
    return this.invoicesService.sendReminder(id);
  }

  @Get()
  findAll(@Query('status') status?: InvoiceStatus) {
    if (status) {
      return this.invoicesService.findByStatus(status);
    }
    return this.invoicesService.findAll();
  }

  @Get('overdue')
  findOverdue() {
    return this.invoicesService.findOverdue();
  }

  @Get('family/:familyId')
  findByFamily(@Param('familyId') familyId: string) {
    return this.invoicesService.findByFamily(familyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Get(':id/pdf')
  async downloadPdf(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    // Same guards as the other read routes (class-level JwtAuthGuard and
    // RolesGuard); findOne is tenant-scoped, so an id from another club 404s.
    const invoice = await this.invoicesService.findOne(id);
    const { buffer, filename } = await this.invoicePdfService.pdfForInvoice(invoice);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    });
    return new StreamableFile(buffer);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() updateInvoiceDto: UpdateInvoiceDto) {
    return this.invoicesService.update(id, updateInvoiceDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.invoicesService.remove(id);
  }
}
