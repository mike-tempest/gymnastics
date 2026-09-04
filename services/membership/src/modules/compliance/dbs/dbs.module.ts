import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DBSCheck } from './entities/dbs-check.entity';
import { DBSService } from './dbs.service';
import { DBSController } from './dbs.controller';
import { DBSRepository } from './dbs.repository';
import { UsersModule } from '../../users/users.module';
import { EmailModule } from '../../email/email.module';

@Module({
  imports: [TypeOrmModule.forFeature([DBSCheck]), UsersModule, EmailModule],
  controllers: [DBSController],
  providers: [DBSService, DBSRepository],
  exports: [DBSService],
})
export class DBSModule {}
