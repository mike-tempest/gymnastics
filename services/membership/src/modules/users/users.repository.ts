import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

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
    // explicit club_id, so a missing context here only affects tenant-scoped
    // admin flows, which always have one.
    const clubId = this.tenantContext.getClubIdOrNull();
    const user = this.userRepository.create({
      ...createUserDto,
      ...(clubId ? { club_id: clubId } : {}),
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
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { user_id: id },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
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
      where: { role },
      order: { created_at: 'DESC' },
    });
  }

  async findByFamily(familyId: string): Promise<User[]> {
    return await this.userRepository.find({
      where: { family_id: familyId },
      order: { created_at: 'DESC' },
    });
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    passwordHash?: string,
  ): Promise<User | null> {
    const updateData: Record<string, unknown> = { ...updateUserDto };
    if (passwordHash) {
      updateData.password_hash = passwordHash;
    }

    await this.userRepository.update(id, updateData);
    return await this.findOne(id);
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.userRepository.update(id, { last_login: new Date() });
  }

  async remove(id: string): Promise<void> {
    await this.userRepository.delete(id);
  }

  async count(): Promise<number> {
    return await this.userRepository.count();
  }
}
