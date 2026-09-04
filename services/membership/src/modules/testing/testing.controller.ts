import { Controller, Post, Get } from '@nestjs/common';
import { DBSService } from '../compliance/dbs/dbs.service';
import { ConsentsService } from '../compliance/consents/consents.service';
import { SessionsService } from '../sessions/sessions.service';

@Controller('testing')
export class TestingController {
  constructor(
    private readonly dbsService: DBSService,
    private readonly consentsService: ConsentsService,
    private readonly sessionsService: SessionsService,
  ) {}

  @Post('trigger-dbs-reminders')
  async triggerDBSReminders() {
    await this.dbsService.checkExpiringDBSChecks();
    return {
      message: 'DBS expiry warning emails triggered',
      info: 'Check MailHog at http://localhost:8025',
    };
  }

  @Post('trigger-consent-reminders')
  async triggerConsentReminders() {
    await this.consentsService.checkExpiredConsents();
    return {
      message: 'Consent expiry warning emails triggered',
      info: 'Check MailHog at http://localhost:8025',
    };
  }

  @Post('trigger-session-reminders')
  async triggerSessionReminders() {
    await this.sessionsService.sendSessionReminders();
    return {
      message: 'Session reminder emails triggered',
      info: 'Check MailHog at http://localhost:8025',
    };
  }

  @Get('info')
  getInfo() {
    return {
      message: 'Email Testing Endpoints',
      endpoints: {
        dbs: 'POST /api/testing/trigger-dbs-reminders',
        consents: 'POST /api/testing/trigger-consent-reminders',
        sessions: 'POST /api/testing/trigger-session-reminders',
      },
      mailhog: 'http://localhost:8025',
      note: 'Make sure you have test data created first',
    };
  }
}
