import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { Family } from '../families/entities/family.entity';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(createUserDto: CreateUserDto, passwordHash: string): Promise<User> {
    // Stamp club_id from the active tenant; the DTO never carries one. Club
    // registration creates its first user through its own transaction with an
    // explicit club_id. Account-management calls must have a tenant context.
    const clubId = this.tenantContext.getClubId();
    await this.assertFamilyInClub(createUserDto.family_id, clubId);
    const user = this.userRepository.create({
      ...createUserDto,
      club_id: clubId,
      password_hash: passwordHash,
    });
    return await this.userRepository.save(user);
  }

  async findStaffDirectory(): Promise<
    Pick<User, 'user_id' | 'first_name' | 'last_name' | 'role'>[]
  > {
    return this.userRepository.find({
      select: { user_id: true, first_name: true, last_name: true, role: true },
      where: {
        club_id: this.tenantContext.getClubId(),
        active: true,
        role: In([
          UserRole.SUPER_ADMIN,
          UserRole.TREASURER,
          UserRole.HEAD_COACH,
          UserRole.SQUAD_COACH,
          UserRole.WELFARE_OFFICER,
          UserRole.COMPETITION_SECRETARY,
        ]),
      },
      order: { last_name: 'ASC', first_name: 'ASC', user_id: 'ASC' },
    });
  }

  async findAll(): Promise<User[]> {
    return await this.userRepository.find({
      where: { club_id: this.tenantContext.getClubId() },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { user_id: id, club_id: this.tenantContext.getClubId() },
    });
  }

  /** Authentication runs before the tenant interceptor; never use on request data routes. */
  async findForAuthentication(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { user_id: id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    // Global uniqueness check used by account creation, never an HTTP lookup.
    return await this.userRepository.findOne({
      where: { email },
    });
  }

  // Only authentication may opt in to reading the stored password hash.
  async findCredentialsByEmail(email: string): Promise<User | null> {
    return await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password_hash')
      .where('user.email = :email', { email })
      .getOne();
  }

  async findByEmailInsensitive(email: string): Promise<User | null> {
    return await this.userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = LOWER(:email)', { email })
      .getOne();
  }

  async findByRole(role: UserRole): Promise<User[]> {
    return await this.userRepository.find({
      where: { role, club_id: this.tenantContext.getClubId() },
      order: { created_at: 'DESC' },
    });
  }

  async findByFamily(familyId: string): Promise<User[]> {
    return await this.userRepository.find({
      where: { family_id: familyId, club_id: this.tenantContext.getClubId() },
      order: { created_at: 'DESC' },
    });
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    passwordHash?: string,
  ): Promise<User | null> {
    const clubId = this.tenantContext.getClubId();
    await this.assertFamilyInClub(updateUserDto.family_id, clubId);
    const updateData: Record<string, unknown> = { ...updateUserDto };
    delete updateData.club_id;
    delete updateData.user_id;
    if (passwordHash) {
      updateData.password_hash = passwordHash;
      updateData.session_version = () => 'session_version + 1';
    }
    if (passwordHash || updateUserDto.email !== undefined || updateUserDto.active === false) {
      updateData.password_reset_hash = null;
      updateData.password_reset_expires_at = null;
    }

    await this.userRepository.update({ user_id: id, club_id: clubId }, updateData);
    return await this.findOne(id);
  }

  async updateLastLogin(id: string): Promise<void> {
    // Login has already authenticated this global user before tenant setup.
    await this.userRepository.update(id, { last_login: new Date() });
  }

  async remove(id: string): Promise<void> {
    await this.userRepository.delete({ user_id: id, club_id: this.tenantContext.getClubId() });
  }

  async count(): Promise<number> {
    return await this.userRepository.count({ where: { club_id: this.tenantContext.getClubId() } });
  }

  private async assertFamilyInClub(familyId: string | undefined, clubId: string): Promise<void> {
    if (!familyId) return;
    const family = await this.userRepository.manager.getRepository(Family).findOne({
      where: { family_id: familyId, club_id: clubId },
    });
    if (!family) throw new NotFoundException('Family not found');
  }
}
