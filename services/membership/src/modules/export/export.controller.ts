import { Controller, Get, Request, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Response } from 'express';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { ExportService } from './export.service';

interface AuthenticatedRequest {
  user?: { user_id?: string; email?: string };
}

/**
 * One-click full club data export.
 *
 * Published pricing and a full export are product features here, not marketing
 * (docs/05-Build-Brief-Positioning-and-Product-Rules.md, rule 6): a club can
 * take its whole record out at any time, without asking and without paying.
 *
 * Admin only. The archive holds medical notes, safeguarding records and
 * everyone's contact details, so it is the club's own super admin who may pull
 * it, not a coach or a treasurer.
 */
@Controller('export')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  /**
   * Building the archive reads every tenant-owned table and then compresses
   * the result, so the route is rate limited well below the default: a club
   * needs its data once, not once a second, and an impatient double-click
   * should not run the whole thing twice.
   */
  @Get('club.zip')
  @Roles(UserRole.SUPER_ADMIN)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 300_000 } })
  async downloadClubExport(
    @Request() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.exportService.buildClubExport({
      userId: req.user?.user_id,
      userEmail: req.user?.email,
    });
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    });
    return new StreamableFile(buffer);
  }
}
