import {
  SetMetadata,
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
import { UuidParam } from '../../../common/validation/parse-uuid.pipe';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.TREASURER)
@SetMetadata('exactRoles', true)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SUPER_ADMIN, UserRole.TREASURER)
  create(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentsService.create(createPaymentDto);
  }

  @Get()
  findAll() {
    return this.paymentsService.findAll();
  }

  @Get('invoice/:invoiceId')
  findByInvoice(@Param('invoiceId', UuidParam) invoiceId: string) {
    return this.paymentsService.findByInvoice(invoiceId);
  }

  @Get(':id')
  findOne(@Param('id', UuidParam) id: string) {
    return this.paymentsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TREASURER)
  update(@Param('id', UuidParam) id: string, @Body() updatePaymentDto: UpdatePaymentDto) {
    return this.paymentsService.update(id, updatePaymentDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.SUPER_ADMIN, UserRole.TREASURER)
  remove(@Param('id', UuidParam) id: string) {
    return this.paymentsService.remove(id);
  }

  @Post('collect-invoice/:invoiceId')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN, UserRole.TREASURER)
  async collectInvoicePayment(@Param('invoiceId', UuidParam) invoiceId: string) {
    const payment = await this.paymentsService.collectInvoiceForCurrentClub(invoiceId);
    return {
      success: !!payment,
      payment,
      message: payment
        ? 'Payment collection initiated successfully'
        : 'No new payment record. Check the invoice balance and any pending provider operation.',
    };
  }

  @Post('collect-pending')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN, UserRole.TREASURER)
  async collectPendingPayments() {
    const stats = await this.paymentsService.collectPendingInvoicePayments(true);
    return {
      success: true,
      stats,
      message: `Processed ${stats.attempted} invoices: ${stats.successful} successful, ${stats.failed} failed, ${stats.skipped} skipped`,
    };
  }
}
