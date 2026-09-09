import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Credential } from './entities/credential.entity';
import { CredentialsController } from './credentials.controller';
import { CredentialsService } from './credentials.service';
import { CredentialsRepository } from './credentials.repository';
import { EmailModule } from '../../email/email.module';
import { UsersModule } from '../../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Credential]), UsersModule, EmailModule],
  controllers: [CredentialsController],
  providers: [CredentialsService, CredentialsRepository],
  exports: [CredentialsService],
})
export class CredentialsModule {}
