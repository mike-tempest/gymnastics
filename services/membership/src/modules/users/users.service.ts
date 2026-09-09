import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { UsersRepository } from './users.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { BulkCreateStaffItemDto } from './dto/bulk-create-staff.dto';
import { User, UserRole } from './entities/user.entity';

// Roles that may be created through the staff bulk import endpoint.
// Administrative, parent and member accounts must be created through
// their own dedicated flows.
const STAFF_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.TREASURER,
  UserRole.HEAD_COACH,
  UserRole.SQUAD_COACH,
  UserRole.WELFARE_OFFICER,
  UserRole.COMPETITION_SECRETARY,
]);

@Injectable()
export class UsersService {
  private readonly SALT_ROUNDS = 10;

  constructor(private readonly usersRepository: UsersRepository) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    // Check if user with email already exists
    const existingUser = await this.usersRepository.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(createUserDto.password, this.SALT_ROUNDS);

    // Create user
    const user = await this.usersRepository.create(createUserDto, passwordHash);

    // Remove password hash from response
    delete user.password_hash;
    return user;
  }

  /**
   * Bulk create staff users with per-row error handling.
   * Each row is processed individually so one bad row never aborts the batch.
   * A cryptographically random password is generated for every user and is
   * never returned or logged; staff set their real password through the
   * password reset flow.
   */
  async bulkCreateStaff(users: BulkCreateStaffItemDto[]): Promise<{
    created: User[];
    errors: Array<{ row: number; message: string }>;
  }> {
    const created: User[] = [];
    const errors: Array<{ row: number; message: string }> = [];
    const seenEmails = new Set<string>();

    for (let i = 0; i < users.length; i++) {
      const row = i + 1;
      const item = users[i];
      const email = item.email.trim().toLowerCase();

      if (seenEmails.has(email)) {
        errors.push({ row, message: `Duplicate email in payload: ${email}` });
        continue;
      }
      seenEmails.add(email);

      if (!STAFF_ROLES.has(item.role)) {
        errors.push({ row, message: `Role ${item.role} is not a staff role` });
        continue;
      }

      try {
        // Case-insensitive check against existing users; the exact-match
        // check inside create() cannot catch mixed-case duplicates.
        const existingUser = await this.usersRepository.findByEmailInsensitive(email);
        if (existingUser) {
          errors.push({ row, message: 'User with this email already exists' });
          continue;
        }

        const temporaryPassword = randomBytes(32).toString('base64url');
        const user = await this.create({
          email,
          password: temporaryPassword,
          first_name: item.first_name,
          last_name: item.last_name,
          role: item.role,
        });
        created.push(user);
      } catch (error: unknown) {
        errors.push({
          row,
          message: error instanceof Error ? error.message : 'Failed to create user',
        });
      }
    }

    return { created, errors };
  }

  async findAll(): Promise<User[]> {
    const users = await this.usersRepository.findAll();
    return users.map((user) => {
      delete user.password_hash;
      return user;
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    delete user.password_hash;
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.usersRepository.findByEmail(email);
  }

  async findCredentialsByEmail(email: string): Promise<User | null> {
    return await this.usersRepository.findCredentialsByEmail(email);
  }

  async findByRole(role: UserRole): Promise<User[]> {
    const users = await this.usersRepository.findByRole(role);
    return users.map((user) => {
      delete user.password_hash;
      return user;
    });
  }

  async findByFamily(familyId: string): Promise<User[]> {
    const users = await this.usersRepository.findByFamily(familyId);
    return users.map((user) => {
      delete user.password_hash;
      return user;
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    await this.findOne(id); // This will throw if not found

    let passwordHash: string | undefined;
    if (updateUserDto.password) {
      passwordHash = await bcrypt.hash(updateUserDto.password, this.SALT_ROUNDS);
      delete updateUserDto.password;
    }

    const updated = await this.usersRepository.update(id, updateUserDto, passwordHash);
    if (!updated) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    delete updated.password_hash;
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id); // This will throw if not found
    await this.usersRepository.remove(id);
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    if (!user.password_hash) {
      return false;
    }
    return await bcrypt.compare(password, user.password_hash);
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.usersRepository.updateLastLogin(userId);
  }
}
