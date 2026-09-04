import { Module } from '@nestjs/common';
import { TestingController } from './testing.controller';
import { DBSModule } from '../compliance/dbs/dbs.module';
import { ConsentsModule } from '../compliance/consents/consents.module';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [DBSModule, ConsentsModule, SessionsModule],
  controllers: [TestingController],
})
export class TestingModule {}
