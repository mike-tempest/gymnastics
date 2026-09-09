import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DataSource, EntityManager } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { AuditLogsService } from '../compliance/audit-logs/audit-logs.service';
import { FamilyInvite } from '../families/entities/family-invite.entity';
import { Family } from '../families/entities/family.entity';
import { User, UserRole } from '../users/entities/user.entity';

// Transaction rollback is modelled here; the HTTP e2e suite exercises PostgreSQL.
describe('Invitation registration', () => {
  const dto: RegisterDto = {
    email: 'Parent@Example.com',
    password: 'Secret123!',
    first_name: 'Pat',
    last_name: 'Smith',
    invite_token: 'a'.repeat(64),
  };
  let invite: FamilyInvite | null;
  let family: Family | null;
  let saved: User[];
  let failDelete: boolean;
  let duplicate: boolean;
  let manager: { findOne: jest.Mock; getRepository: jest.Mock; delete: jest.Mock };
  let service: AuthService;
  let signAsync: jest.Mock;
  let sendWelcome: jest.Mock;

  beforeEach(() => {
    invite = {
      invite_id: 'invite',
      token: dto.invite_token,
      club_id: 'club-a',
      family_id: 'family-a',
      expires_at: new Date(Date.now() + 60000),
    } as FamilyInvite;
    family = { family_id: 'family-a', club_id: 'club-a' } as Family;
    saved = [];
    failDelete = false;
    duplicate = false;
    manager = {
      findOne: jest.fn(async (entity, options) => {
        if (entity === FamilyInvite) return invite?.token === options.where.token ? invite : null;
        return family?.club_id === options.where.club_id ? family : null;
      }),
      getRepository: jest.fn(() => ({
        create: (data: Partial<User>) => ({ ...data, user_id: 'new-user' }),
        save: async (user: User) => {
          if (duplicate) throw Object.assign(new Error('unique violation'), { code: '23505' });
          saved.push({ ...user });
          return user;
        },
      })),
      delete: jest.fn(async () => {
        if (failDelete) throw new Error('delete failed');
        invite = null;
      }),
    };
    const source = {
      transaction: async (work: (manager: EntityManager) => Promise<User>) => {
        const before = { saved: [...saved], invite };
        try {
          return await work(manager as unknown as EntityManager);
        } catch (error) {
          saved = before.saved;
          invite = before.invite;
          throw error;
        }
      },
    };
    signAsync = jest.fn().mockResolvedValue('token');
    sendWelcome = jest.fn().mockResolvedValue(undefined);
    service = new AuthService(
      {} as UsersService,
      { signAsync } as unknown as JwtService,
      { sendWelcome } as unknown as EmailService,
      { get: () => 'http://localhost:3000' } as unknown as ConfigService,
      {} as AuditLogsService,
      source as unknown as DataSource,
    );
  });

  it('derives tenancy and parent role from the invitation and removes the hash from the response', async () => {
    const result = await service.register({
      ...dto,
      role: 'super_admin',
      club_id: 'club-b',
      family_id: 'family-b',
    } as RegisterDto);
    expect(saved[0]).toMatchObject({
      club_id: 'club-a',
      family_id: 'family-a',
      role: UserRole.PARENT,
      email: 'parent@example.com',
    });
    expect(await bcrypt.compare(dto.password, saved[0].password_hash!)).toBe(true);
    expect(result.user.password_hash).toBeUndefined();
    expect(signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ club_id: 'club-a', role: UserRole.PARENT }),
    );
    expect(invite).toBeNull();
    expect(manager.findOne).toHaveBeenCalledWith(
      FamilyInvite,
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
    expect(sendWelcome).toHaveBeenCalled();
  });

  it('requires an invitation before creating an account', async () => {
    await expect(service.register({ ...dto, invite_token: undefined })).rejects.toThrow(
      BadRequestException,
    );
    expect(saved).toEqual([]);
    expect(signAsync).not.toHaveBeenCalled();
  });

  it.each(['missing', 'expired', 'wrong-club'])('rejects a %s invitation', async (kind) => {
    if (kind === 'missing') invite = null;
    if (kind === 'expired') invite!.expires_at = new Date(Date.now() - 1);
    if (kind === 'wrong-club') family!.club_id = 'club-b';
    await expect(service.register(dto)).rejects.toThrow(BadRequestException);
    expect(saved).toEqual([]);
  });

  it('rejects a consumed invitation', async () => {
    await service.register(dto);
    await expect(service.register({ ...dto, email: 'other@example.com' })).rejects.toThrow(
      BadRequestException,
    );
    expect(saved).toHaveLength(1);
  });

  it('rolls back the account if consuming the invitation fails', async () => {
    failDelete = true;
    await expect(service.register(dto)).rejects.toThrow('delete failed');
    expect(saved).toEqual([]);
    expect(invite).not.toBeNull();
    expect(signAsync).not.toHaveBeenCalled();
  });

  it('returns a conflict without consuming the invitation for a duplicate email', async () => {
    duplicate = true;
    await expect(service.register(dto)).rejects.toThrow(ConflictException);
    expect(invite).not.toBeNull();
    expect(saved).toEqual([]);
  });
});
