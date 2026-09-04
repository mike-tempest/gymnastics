import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WaitlistEntry } from './entities/waitlist.entity';
import { WaitlistService } from './waitlist.service';
import { WaitlistRepository } from './waitlist.repository';
import { WaitlistController } from './waitlist.controller';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [TypeOrmModule.forFeature([WaitlistEntry]), EmailModule],
  controllers: [WaitlistController],
  providers: [WaitlistService, WaitlistRepository],
  exports: [WaitlistService, WaitlistRepository],
})
export class WaitlistModule {}
