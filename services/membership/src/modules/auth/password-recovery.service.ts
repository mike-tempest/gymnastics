import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { EmailService } from '../email/email.service';
import { User } from '../users/entities/user.entity';

export const RECOVERY_MESSAGE =
  'If an active account matches that email address, we will send a password reset link. Please check your inbox and spam folder.';

@Injectable()
export class PasswordRecoveryService {
  private readonly logger = new Logger(PasswordRecoveryService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  async requestReset(email: string): Promise<{ message: string }> {
    const repository = this.dataSource.getRepository(User);
    // Public recovery has no tenant context. Resolve only an unambiguous account;
    // never accept a caller-supplied club, family, role or user identifier.
    const users = await repository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = :email', { email: email.trim().toLowerCase() })
      .take(2)
      .getMany();
    const user = users.length === 1 && users[0].active ? users[0] : null;
    if (user) {
      const token = randomBytes(32).toString('hex');
      const hash = this.hash(token);
      // The conditional update also serialises concurrent requests and enforces
      // the account cooldown across service instances, independently of IP limits.
      const result = await repository
        .createQueryBuilder()
        .update(User)
        .set({
          password_reset_hash: hash,
          password_reset_expires_at: () => "CURRENT_TIMESTAMP + INTERVAL '30 minutes'",
          password_reset_requested_at: () => 'CURRENT_TIMESTAMP',
        })
        .where('user_id = :id AND club_id = :club AND email = :email AND active = true', {
          id: user.user_id,
          club: user.club_id,
          email: user.email,
        })
        .andWhere(
          "(password_reset_requested_at IS NULL OR password_reset_requested_at < CURRENT_TIMESTAMP - INTERVAL '1 minute')",
        )
        .execute();
      if (result.affected === 1) {
        const url = new URL(
          '/reset-password',
          this.configService.get('APP_URL', 'http://localhost:3000'),
        );
        // Fragments never reach access logs or Referer headers.
        url.hash = token;
        // Do not make public response timing depend on the email provider.
        // A failed delivery revokes only this link, never a newer request's link.
        void this.deliver(user, hash, url.toString());
      }
    }
    return { message: RECOVERY_MESSAGE };
  }

  private async deliver(user: User, hash: string, resetUrl: string): Promise<void> {
    try {
      await this.emailService.sendPasswordRecovery(user.email, resetUrl);
    } catch {
      this.logger.error('Password recovery email failed; the affected link is being revoked');
      try {
        await this.dataSource
          .getRepository(User)
          .update(
            { user_id: user.user_id, club_id: user.club_id, password_reset_hash: hash },
            { password_reset_hash: null, password_reset_expires_at: null },
          );
      } catch {
        this.logger.error('Could not revoke failed password recovery delivery');
      }
    }
  }

  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    const passwordHash = await bcrypt.hash(password, 10);
    // A single conditional UPDATE consumes the token and changes credentials.
    // Two concurrent consumers cannot both succeed, even on different instances.
    const result = await this.dataSource
      .getRepository(User)
      .createQueryBuilder()
      .update(User)
      .set({
        password_hash: passwordHash,
        password_reset_hash: null,
        password_reset_expires_at: null,
        session_version: () => 'session_version + 1',
      })
      .where('password_reset_hash = :hash', { hash: this.hash(token) })
      .andWhere('password_reset_expires_at > CURRENT_TIMESTAMP AND active = true')
      .execute();
    if (result.affected !== 1) {
      throw new BadRequestException(
        'This reset link is invalid or has expired. Request a new link.',
      );
    }
    return { message: 'Your password has been reset. Sign in with your new password.' };
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
