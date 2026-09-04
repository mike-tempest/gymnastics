import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailService } from './email.service';
import { EmailSuppression } from './entities/email-suppression.entity';
import { UnsubscribeController } from './unsubscribe.controller';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([EmailSuppression])],
  controllers: [UnsubscribeController],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
