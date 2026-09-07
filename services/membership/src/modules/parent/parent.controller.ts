import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  NotFoundException,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { ParentService } from './parent.service';
import { ParentMandateService } from './parent-mandate.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InvoicePdfService } from '../finance/invoices/invoice-pdf.service';
import { UpdateParentProfileDto } from './dto/update-parent-profile.dto';
import { StartMandateSetupDto, CompleteMandateSetupDto } from './dto/mandate-setup.dto';
import { CompetitionsEnabledGuard } from '../../common/features/competitions.feature';

@Controller('parent')
@UseGuards(JwtAuthGuard)
export class ParentController {
  constructor(
    private readonly parentService: ParentService,
    private readonly invoicePdfService: InvoicePdfService,
    private readonly parentMandateService: ParentMandateService,
  ) {}

  @Get('profile')
  async getProfile(@Request() req: { user?: { family_id?: string } }) {
    const familyId = req.user?.family_id;
    if (!familyId) {
      throw new NotFoundException('User not associated with a family');
    }
    return this.parentService.getProfile(familyId);
  }

  @Patch('profile')
  async updateProfile(
    @Request() req: { user?: { family_id?: string } },
    @Body() dto: UpdateParentProfileDto,
  ) {
    const familyId = req.user?.family_id;
    if (!familyId) {
      throw new NotFoundException('User not associated with a family');
    }
    return this.parentService.updateProfile(familyId, dto);
  }

  @Get('dashboard')
  async getDashboard(@Request() req: { user?: { family_id?: string } }) {
    const familyId = req.user?.family_id;
    if (!familyId) {
      throw new NotFoundException('User not associated with a family');
    }
    return this.parentService.getDashboard(familyId);
  }

  @Get('children')
  async getChildren(@Request() req: { user?: { family_id?: string } }) {
    const familyId = req.user?.family_id;
    if (!familyId) {
      throw new NotFoundException('User not associated with a family');
    }
    return this.parentService.getChildren(familyId);
  }

  @Get('children/:id')
  async getChild(@Request() req: { user?: { family_id?: string } }, @Param('id') childId: string) {
    const familyId = req.user?.family_id;
    if (!familyId) {
      throw new NotFoundException('User not associated with a family');
    }
    return this.parentService.getChild(familyId, childId);
  }

  @Get('children/:id/attendance')
  async getChildAttendance(
    @Request() req: { user?: { family_id?: string } },
    @Param('id') childId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const familyId = req.user?.family_id;
    if (!familyId) {
      throw new NotFoundException('User not associated with a family');
    }
    return this.parentService.getChildAttendance(familyId, childId, from, to);
  }

  @Get('children/:id/schedule')
  async getChildSchedule(
    @Request() req: { user?: { family_id?: string } },
    @Param('id') childId: string,
    @Query('days') days?: number,
  ) {
    const familyId = req.user?.family_id;
    if (!familyId) {
      throw new NotFoundException('User not associated with a family');
    }
    return this.parentService.getChildSchedule(familyId, childId, days);
  }

  @Get('children/:id/badges')
  async getChildBadges(
    @Request() req: { user?: { family_id?: string } },
    @Param('id') childId: string,
  ) {
    const familyId = req.user?.family_id;
    if (!familyId) {
      throw new NotFoundException('User not associated with a family');
    }
    return this.parentService.getChildBadges(familyId, childId);
  }

  // 404s while the competitions module is flagged off (TEM-15).
  @Get('children/:id/results')
  @UseGuards(CompetitionsEnabledGuard)
  async getChildResults(
    @Request() req: { user?: { family_id?: string } },
    @Param('id') childId: string,
  ) {
    const familyId = req.user?.family_id;
    if (!familyId) {
      throw new NotFoundException('User not associated with a family');
    }
    return this.parentService.getChildResults(familyId, childId);
  }

  // 404s while the competitions module is flagged off (TEM-15).
  @Get('children/:id/personal-bests')
  @UseGuards(CompetitionsEnabledGuard)
  async getChildPersonalBests(
    @Request() req: { user?: { family_id?: string } },
    @Param('id') childId: string,
  ) {
    const familyId = req.user?.family_id;
    if (!familyId) {
      throw new NotFoundException('User not associated with a family');
    }
    return this.parentService.getChildPersonalBests(familyId, childId);
  }

  @Get('invoices')
  async getInvoices(
    @Request() req: { user?: { family_id?: string } },
    @Query('status') status?: string,
  ) {
    const familyId = req.user?.family_id;
    if (!familyId) {
      throw new NotFoundException('User not associated with a family');
    }
    return this.parentService.getInvoices(familyId, status);
  }

  @Get('invoices/:id')
  async getInvoice(
    @Request() req: { user?: { family_id?: string } },
    @Param('id') invoiceId: string,
  ) {
    const familyId = req.user?.family_id;
    if (!familyId) {
      throw new NotFoundException('User not associated with a family');
    }
    return this.parentService.getInvoice(familyId, invoiceId);
  }

  @Get('invoices/:id/pdf')
  async getInvoicePdf(
    @Request() req: { user?: { family_id?: string } },
    @Param('id') invoiceId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const familyId = req.user?.family_id;
    if (!familyId) {
      throw new NotFoundException('User not associated with a family');
    }
    // Reuses the same ownership check as GET /parent/invoices/:id: the invoice
    // resolves only when it belongs to the calling parent's family within the
    // active club, otherwise 404.
    const invoice = await this.parentService.getInvoice(familyId, invoiceId);
    const { buffer, filename } = await this.invoicePdfService.pdfForInvoice(invoice);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    });
    return new StreamableFile(buffer);
  }

  @Get('payments')
  async getPayments(@Request() req: { user?: { family_id?: string } }) {
    const familyId = req.user?.family_id;
    if (!familyId) {
      throw new NotFoundException('User not associated with a family');
    }
    return this.parentService.getPayments(familyId);
  }

  @Get('sessions/upcoming')
  async getUpcomingSessions(@Request() req: { user?: { family_id?: string } }) {
    const familyId = req.user?.family_id;
    if (!familyId) {
      throw new NotFoundException('User not associated with a family');
    }
    return this.parentService.getUpcomingSessions(familyId);
  }

  /**
   * Direct Debit setup, started by the parent who is paying.
   *
   * The family comes from the JWT, exactly as every other route on this
   * controller resolves it, so a parent can only ever set up a mandate for
   * their own family. The session token is minted server-side and returned;
   * the browser carries it across the provider redirect and hands it back to
   * the completion call, where it is verified. The SUPER_ADMIN routes on
   * MandatesController are untouched.
   */
  @Post('mandates/setup/start')
  @HttpCode(HttpStatus.CREATED)
  async startMandateSetup(
    @Request() req: { user?: { family_id?: string } },
    @Body() dto: StartMandateSetupDto,
  ) {
    const familyId = req.user?.family_id;
    if (!familyId) {
      throw new NotFoundException('User not associated with a family');
    }
    return this.parentMandateService.startSetup(familyId, dto.success_redirect_url);
  }

  @Post('mandates/setup/complete')
  @HttpCode(HttpStatus.CREATED)
  async completeMandateSetup(
    @Request() req: { user?: { family_id?: string } },
    @Body() dto: CompleteMandateSetupDto,
  ) {
    const familyId = req.user?.family_id;
    if (!familyId) {
      throw new NotFoundException('User not associated with a family');
    }
    return this.parentMandateService.completeSetup(
      familyId,
      dto.redirect_flow_id,
      dto.session_token,
    );
  }

  @Post('invoices/:id/pay')
  @HttpCode(HttpStatus.OK)
  async payInvoice(
    @Request() req: { user?: { family_id?: string } },
    @Param('id') invoiceId: string,
  ) {
    const familyId = req.user?.family_id;
    if (!familyId) {
      throw new NotFoundException('User not associated with a family');
    }
    return this.parentService.initiatePayment(familyId, invoiceId);
  }
}
