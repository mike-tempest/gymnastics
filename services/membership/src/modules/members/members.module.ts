import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { MembersRepository } from './members.repository';
import { Member } from './entities/member.entity';
import { FamiliesModule } from '../families/families.module';

@Module({
  imports: [TypeOrmModule.forFeature([Member]), FamiliesModule],
  controllers: [MembersController],
  providers: [MembersService, MembersRepository],
  exports: [MembersService, MembersRepository],
})
export class MembersModule {}
