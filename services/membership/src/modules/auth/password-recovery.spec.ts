import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource } from 'typeorm';
import { PasswordRecoveryService, RECOVERY_MESSAGE } from './password-recovery.service';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-recovery.dto';
import { EmailService } from '../email/email.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersService } from '../users/users.service';

const token = 'a'.repeat(64);

describe('Password recovery', () => {
  it('normalises email and rejects caller-supplied account/club/family fields', async () => {
    const dto = plainToInstance(ForgotPasswordDto, {
      email: ' Parent@Example.com ',
      club_id: 'other',
      family_id: 'other',
      user_id: 'other',
    });
    expect(dto.email).toBe('parent@example.com');
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.map((error) => error.property).sort()).toEqual([
      'club_id',
      'family_id',
      'user_id',
    ]);
  });

  it.each(['short', 'a'.repeat(73), 'é'.repeat(37)])(
    'rejects unsupported password length',
    async (password) => {
      expect(
        await validate(plainToInstance(ResetPasswordDto, { token, password })),
      ).not.toHaveLength(0);
    },
  );

  it('accepts Unicode passwords within the bcrypt byte limit', async () => {
    expect(
      await validate(plainToInstance(ResetPasswordDto, { token, password: 'Mötley-Crüe-2026' })),
    ).toHaveLength(0);
  });

  it('rejects malformed tokens', async () => {
    expect(
      await validate(
        plainToInstance(ResetPasswordDto, { token: 'invalid', password: 'NewPassword123' }),
      ),
    ).not.toHaveLength(0);
  });

  it('does not wait for the mail provider before returning the neutral response', async () => {
    const query = {
      where: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest
        .fn()
        .mockResolvedValue([
          { user_id: 'u', club_id: 'c', email: 'parent@example.com', active: true },
        ]),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    let finishDelivery!: () => void;
    const email = {
      sendPasswordRecovery: jest.fn(
        () =>
          new Promise<void>((resolve) => {
            finishDelivery = resolve;
          }),
      ),
    };
    const service = new PasswordRecoveryService(
      { getRepository: () => ({ createQueryBuilder: () => query }) } as unknown as DataSource,
      email as unknown as EmailService,
      new ConfigService({ APP_URL: 'https://tumblebase.example' }),
    );
    expect(await service.requestReset('parent@example.com')).toEqual({ message: RECOVERY_MESSAGE });
    expect(email.sendPasswordRecovery).toHaveBeenCalledWith(
      'parent@example.com',
      expect.stringMatching(/^https:\/\/tumblebase.example\/reset-password#[a-f0-9]{64}$/),
    );
    finishDelivery();
  });
});

describe('Password reset session invalidation', () => {
  const config = new ConfigService({ JWT_SECRET: 'test-secret-only' });
  const payload = { sub: 'user-a', email: 'parent@example.com', role: 'parent', club_id: 'club-a' };
  it.each([undefined, 0, 1])('rejects a token with old session version %s', async (version) => {
    const users = {
      findForAuthentication: jest.fn().mockResolvedValue({
        user_id: 'user-a',
        club_id: 'club-a',
        active: true,
        session_version: 2,
      }),
    };
    const strategy = new JwtStrategy(config, users as unknown as UsersService);
    await expect(strategy.validate({ ...payload, session_version: version })).rejects.toThrow();
  });
  it('preserves untouched legacy sessions and accepts newly issued sessions', async () => {
    const users = {
      findForAuthentication: jest
        .fn()
        .mockResolvedValue({ club_id: 'club-a', active: true, session_version: 0 }),
    };
    const strategy = new JwtStrategy(config, users as unknown as UsersService);
    await expect(strategy.validate(payload)).resolves.toMatchObject({ active: true });
    users.findForAuthentication.mockResolvedValue({
      club_id: 'club-a',
      active: true,
      session_version: 2,
    });
    await expect(strategy.validate({ ...payload, session_version: 2 })).resolves.toMatchObject({
      active: true,
    });
  });
  it('rejects inactive accounts even with a current token', async () => {
    const users = {
      findForAuthentication: jest
        .fn()
        .mockResolvedValue({ club_id: 'club-a', active: false, session_version: 0 }),
    };
    await expect(
      new JwtStrategy(config, users as unknown as UsersService).validate(payload),
    ).rejects.toThrow();
  });
  it('rejects a token issued for a different club', async () => {
    const users = {
      findForAuthentication: jest
        .fn()
        .mockResolvedValue({ club_id: 'club-b', active: true, session_version: 0 }),
    };
    await expect(
      new JwtStrategy(config, users as unknown as UsersService).validate(payload),
    ).rejects.toThrow();
  });
  it('uses the current account role rather than a revoked token role', async () => {
    const users = {
      findForAuthentication: jest.fn().mockResolvedValue({
        club_id: 'club-a',
        role: 'squad_coach',
        active: true,
        session_version: 0,
      }),
    };
    await expect(
      new JwtStrategy(config, users as unknown as UsersService).validate({
        ...payload,
        role: 'welfare_officer',
      }),
    ).resolves.toMatchObject({ role: 'squad_coach' });
  });
});
