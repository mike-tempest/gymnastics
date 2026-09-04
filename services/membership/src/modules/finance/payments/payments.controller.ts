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
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SUPER_ADMIN)
  create(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentsService.create(createPaymentDto);
  }

  @Get()
  findAll() {
    return this.paymentsService.findAll();
  }

  @Get('invoice/:invoiceId')
  findByInvoice(@Param('invoiceId') invoiceId: string) {
    return this.paymentsService.findByInvoice(invoiceId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() updatePaymentDto: UpdatePaymentDto) {
    return this.paymentsService.update(id, updatePaymentDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.paymentsService.remove(id);
  }

  @Post('collect-invoice/:invoiceId')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN)
  async collectInvoicePayment(@Param('invoiceId') invoiceId: string) {
    const payment = await this.paymentsService.collectDirectDebitPayment(invoiceId);
    return {
      success: !!payment,
      payment,
      message: payment
        ? 'Payment collection initiated successfully'
        : 'No active mandate found or invoice already paid',
    };
  }

  @Post('collect-pending')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN)
  async collectPendingPayments() {
    const stats = await this.paymentsService.collectPendingInvoicePayments();
    return {
      success: true,
      stats,
      message: `Processed ${stats.attempted} invoices: ${stats.successful} successful, ${stats.failed} failed, ${stats.skipped} skipped`,
    };
  }
}
