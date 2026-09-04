import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { FamiliesRepository } from './families.repository';
import { CreateFamilyDto } from './dto/create-family.dto';
import { UpdateFamilyDto } from './dto/update-family.dto';
import { Family } from './entities/family.entity';
import { UsersService } from '../users/users.service';

// Invite tokens are valid for 7 days
const INVITE_EXPIRY_DAYS = 7;

@Injectable()
export class FamiliesService {
  private readonly appUrl: string;

  constructor(
    private readonly familiesRepository: FamiliesRepository,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    this.appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
  }

  async create(createFamilyDto: CreateFamilyDto): Promise<Family> {
    try {
      return await this.familiesRepository.create(createFamilyDto);
    } catch (error: unknown) {
      if (error instanceof Object && 'code' in error && error.code === '23505') {
        throw new BadRequestException('A family with this information already exists');
      }
      throw error;
    }
  }

  async findAll(): Promise<Family[]> {
    return await this.familiesRepository.findAll();
  }

  async findOne(id: string): Promise<Family> {
    const family = await this.familiesRepository.findOne(id);
    if (!family) {
      throw new NotFoundException(`Family with ID ${id} not found`);
    }
    return family;
  }

  async update(id: string, updateFamilyDto: UpdateFamilyDto): Promise<Family> {
    await this.findOne(id); // This will throw if not found

    try {
      const updated = await this.familiesRepository.update(id, updateFamilyDto);
      if (!updated) {
        throw new NotFoundException(`Family with ID ${id} not found`);
      }
      return updated;
    } catch (error: unknown) {
      if (error instanceof Object && 'code' in error && error.code === '23505') {
        throw new BadRequestException('A family with this information already exists');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id); // This will throw if not found
    await this.familiesRepository.remove(id);
  }

  async getStatistics() {
    const total = await this.familiesRepository.count();
    return {
      total,
    };
  }

  // Family invite methods

  async generateInvite(familyId: string): Promise<{ token: string; inviteUrl: string }> {
    // Verify the family exists before generating an invite
    await this.findOne(familyId);

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

    await this.familiesRepository.createInvite(familyId, token, expiresAt);

    const inviteUrl = `${this.appUrl}/invite/${token}`;

    return { token, inviteUrl };
  }

  async acceptInvite(token: string, userId?: string): Promise<Family> {
    const invite = await this.familiesRepository.findInviteByToken(token);

    if (!invite) {
      throw new BadRequestException('Invite token is invalid or has expired');
    }

    const family = invite.family!;

    // Link the user to the family if userId is provided
    if (userId) {
      await this.usersService.update(userId, { family_id: family.family_id });
    }

    // Remove the invite to prevent reuse
    await this.familiesRepository.removeInvite(invite.invite_id);

    return family;
  }

  async verifyInviteToken(token: string): Promise<{ valid: boolean; family?: Family }> {
    const invite = await this.familiesRepository.findInviteByToken(token);

    if (!invite) {
      return { valid: false };
    }

    return { valid: true, family: invite.family };
  }
}
