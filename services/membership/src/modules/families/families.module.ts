import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FamiliesController } from './families.controller';
import { FamiliesService } from './families.service';
import { FamiliesRepository } from './families.repository';
import { Family } from './entities/family.entity';
import { FamilyInvite } from './entities/family-invite.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Family, FamilyInvite]), UsersModule],
  controllers: [FamiliesController],
  providers: [FamiliesService, FamiliesRepository],
  exports: [FamiliesService, FamiliesRepository],
})
export class FamiliesModule {}
