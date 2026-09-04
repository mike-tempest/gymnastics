import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RegisterClubDto } from './dto/register-club.dto';
import { User, UserRole } from '../users/entities/user.entity';
import { Club, ClubStatus } from '../clubs/entities/club.entity';
import { ClubSettings } from '../admin/settings/club-settings.entity';
import { AuditLogsService } from '../compliance/audit-logs/audit-logs.service';
import { mapRole } from './role-mapping';
import { generateUniqueSlug } from './slug.util';
import {
  defaultTaxLabelForCountry,
  isValidTimezoneForCountry,
  regionForCountry,
} from '../../common/region/region.util';
import { formatClubDateTime } from '../../common/region/format.util';
import {
  COUNTRY_GOVERNING_BODIES,
  GoverningBody,
  defaultGoverningBodyForCountry,
} from '@swim-nexus/shared-types';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly appUrl: string;
  private readonly SALT_ROUNDS = 10;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly auditLogsService: AuditLogsService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    this.appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
  }

  async register(registerDto: RegisterDto): Promise<{ access_token: string; user: User }> {
    // The web app sends coarse uppercase roles (PARENT/COACH/ADMIN); map them to
    // the lowercase UserRole enum. Defaults to PARENT when absent or unmapped.
    const role = mapRole(registerDto.role) ?? UserRole.PARENT;
    const user = await this.usersService.create({ ...registerDto, role });
    const payload = {
      sub: user.user_id,
      email: user.email,
      role: user.role,
      club_id: user.club_id,
    };
    const access_token = await this.jwtService.signAsync(payload);

    this.logger.log(`User registered: ${user.email}`);

    // Send welcome email (non-blocking)
    this.emailService
      .sendWelcome({
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        recipientEmail: user.email,
        role: user.role,
        loginUrl: `${this.appUrl}/login`,
      })
      .catch((error) => {
        this.logger.error(`Failed to send welcome email to ${user.email}`, error);
        // Don't throw - email failures shouldn't block registration
      });

    return { access_token, user };
  }

  /**
   * Self-serve club signup: create a new club, its first super_admin, and the
   * club's settings row in a SINGLE all-or-nothing transaction, then return a
   * session exactly like `login`.
   *
   * This is a public route with no CLS tenant context (it CREATES the tenant),
   * so it never relies on `getClubId()`. The new club's id is passed explicitly
   * to every insert via the transaction's EntityManager, mirroring how the
   * GoCardless webhook path uses explicit club ids rather than request context.
   * If any step fails the transaction rolls back, leaving no orphan club, user,
   * or settings row.
   */
  async registerClub(dto: RegisterClubDto): Promise<{ access_token: string; user: User }> {
    const adminEmail = dto.admin.email.trim().toLowerCase();

    let clubSlug = '';
    const createdRecords = await this.dataSource.transaction(async (manager) => {
      const clubRepo = manager.getRepository(Club);
      const userRepo = manager.getRepository(User);
      const settingsRepo = manager.getRepository(ClubSettings);

      // 1. Reject if the admin email already exists (any club).
      const existingUser = await userRepo.findOne({ where: { email: adminEmail } });
      if (existingUser) {
        throw new ConflictException('A user with this email already exists');
      }

      // 2. Generate a unique, url-safe slug from the club name. If the base slug
      //    is taken, suffix it (-2, -3, ...). Reject only if even that fails.
      const slug = await generateUniqueSlug(dto.club.name, async (candidate) => {
        const found = await clubRepo.findOne({ where: { slug: candidate } });
        return found !== null;
      });
      clubSlug = slug;

      // 3. Create the clubs row. Country defaults to GB; currency, timezone,
      //    and locale are either supplied explicitly or derived from the
      //    country's regional config, so existing UK signups stay
      //    GB/GBP/Europe/London/en-GB and behave exactly as before. A timezone
      //    that is not a valid choice for the country is replaced with the
      //    country's default rather than rejected.
      const country = dto.club.country?.trim().toUpperCase() || 'GB';
      const region = regionForCountry(country);
      const currency = dto.club.currency?.trim().toUpperCase() || region.currency;
      const requestedTimezone = dto.club.timezone?.trim();
      const timezone =
        requestedTimezone && isValidTimezoneForCountry(country, requestedTimezone)
          ? requestedTimezone
          : region.defaultTimezone;
      const locale = dto.club.locale?.trim() || region.locale;

      // Resolve the club's governing body. Honour the submitted value only when
      // it is a valid choice for the club's country; otherwise fall back to the
      // country's default body. Existing GB signups that send nothing become
      // SWIM_ENGLAND, matching the backfill of legacy clubs.
      const submittedBody = dto.club.governing_body?.trim();
      const validBodies = COUNTRY_GOVERNING_BODIES[country] ?? [];
      const governingBody =
        submittedBody && validBodies.includes(submittedBody as GoverningBody)
          ? submittedBody
          : defaultGoverningBodyForCountry(country);

      // Prefer the new affiliation fields; fall back to the legacy DTO fields so
      // older clients keep working. These write to the new club columns only.
      const governingBodyRegion =
        dto.club.governing_body_region?.trim() ?? dto.club.swim_england_region?.trim() ?? null;
      const affiliationNumber =
        dto.club.affiliation_number?.trim() ?? dto.club.affiliate_number?.trim() ?? null;

      const club = await clubRepo.save(
        clubRepo.create({
          name: dto.club.name.trim(),
          slug,
          governing_body: governingBody,
          governing_body_region: governingBodyRegion,
          affiliation_number: affiliationNumber,
          county: dto.club.county ?? null,
          contact_email: dto.club.contact_email ?? null,
          phone: dto.club.phone ?? null,
          website: dto.club.website ?? null,
          country,
          currency,
          timezone,
          locale,
          // Default only the NAME of the tax from the country (GB/IE VAT,
          // AU/CA GST, US Sales tax). The rate is deliberately left null: a
          // label costs nothing, whereas a defaulted rate would wrongly tax
          // clubs that are not registered for GST/VAT. Invoices stay tax-free
          // until the club sets a rate in settings.
          tax_label: defaultTaxLabelForCountry(country),
          status: ClubStatus.ACTIVE,
        }),
      );

      // 4. Create the first user as super_admin, scoped to the new club, with a
      //    hashed password (same bcrypt cost as UsersService).
      const passwordHash = await bcrypt.hash(dto.admin.password, this.SALT_ROUNDS);
      const user = await userRepo.save(
        userRepo.create({
          club_id: club.id,
          email: adminEmail,
          password_hash: passwordHash,
          first_name: dto.admin.first_name.trim(),
          last_name: dto.admin.last_name.trim(),
          role: UserRole.SUPER_ADMIN,
          active: true,
        }),
      );

      // 5. Create the club's settings row (one per club), seeded from the club
      //    details. club_id is set explicitly, never from request context.
      // Affiliation data now lives on the Club entity's columns
      // (governing_body / governing_body_region / affiliation_number), so the
      // settings row no longer stores the swim_england JSONB key. Existing rows
      // are left untouched.
      const settings = settingsRepo.create({
        club_id: club.id,
        club_name: dto.club.name.trim(),
        locations: [],
        billing_config: {},
        notification_prefs: {
          notifyNewMember: true,
          notifyPaymentReceived: true,
          notifyAttendanceAlerts: false,
        },
      });
      // Optional contact fields only set when supplied (columns are nullable).
      if (dto.club.contact_email) settings.contact_email = dto.club.contact_email;
      if (dto.club.phone) settings.phone = dto.club.phone;
      if (dto.club.website) settings.website = dto.club.website;
      await settingsRepo.save(settings);

      return { user, club };
    });
    const createdUser = createdRecords.user;
    const createdClub = createdRecords.club;

    // 6. Issue a session exactly like login (JWT carries club_id).
    const payload = {
      sub: createdUser.user_id,
      email: createdUser.email,
      role: createdUser.role,
      club_id: createdUser.club_id,
    };
    const access_token = await this.jwtService.signAsync(payload);

    delete createdUser.password_hash;

    this.logger.log(
      `Club registered: ${dto.club.name} (admin ${createdUser.email}, club ${createdUser.club_id})`,
    );

    // Record the signup itself: this is the head of the activation funnel that
    // every later engagement metric is measured against. Best-effort, and
    // deliberately outside the transaction so an audit failure cannot roll back
    // a successful signup.
    this.auditLogsService
      .logClubSignup(
        createdUser.user_id,
        createdUser.email,
        createdUser.club_id,
        dto.club.name.trim(),
      )
      .catch((error) => {
        this.logger.error(`Failed to write signup audit log for ${dto.club.name}`, error);
      });

    // Welcome email is best-effort and must not block or roll back signup.
    this.emailService
      .sendWelcome({
        firstName: createdUser.first_name,
        lastName: createdUser.last_name,
        email: createdUser.email,
        recipientEmail: createdUser.email,
        role: createdUser.role,
        loginUrl: `${this.appUrl}/login`,
      })
      .catch((error) => {
        this.logger.error(`Failed to send welcome email to ${createdUser.email}`, error);
      });

    // Best-effort internal alert to the Swimly team. Never blocks or rolls
    // back signup; failures are logged and swallowed like the welcome email.
    this.emailService
      .sendNewClubSignupAlert({
        newClubName: dto.club.name.trim(),
        slug: clubSlug,
        clubId: createdUser.club_id,
        region: createdClub.governing_body_region ?? undefined,
        county: dto.club.county ?? undefined,
        affiliateNumber: createdClub.affiliation_number ?? undefined,
        clubContactEmail: dto.club.contact_email ?? undefined,
        adminName: `${createdUser.first_name} ${createdUser.last_name}`.trim(),
        adminEmail: createdUser.email,
        signedUpAt: formatClubDateTime(new Date(), createdClub.locale, createdClub.timezone),
      })
      .catch((error) => {
        this.logger.error(`Failed to send new-club signup alert for ${dto.club.name}`, error);
      });

    return { access_token, user: createdUser };
  }

  async login(
    loginDto: LoginDto,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<{ access_token: string; user: User }> {
    // Find user by email
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Validate password
    const isPasswordValid = await this.usersService.validatePassword(user, loginDto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.active) {
      throw new UnauthorizedException('Account is inactive');
    }

    // Update last login
    await this.usersService.updateLastLogin(user.user_id);

    // Record the login in the audit trail. Best-effort: a failure here must
    // never stop someone signing in, so it is logged and swallowed like the
    // welcome email. club_id is passed explicitly because login is a public
    // route with no tenant context established yet.
    this.auditLogsService
      .logLogin(user.user_id, user.email, user.club_id, context?.ipAddress, context?.userAgent)
      .catch((error) => {
        this.logger.error(`Failed to write login audit log for ${user.email}`, error);
      });

    // Generate JWT
    const payload = {
      sub: user.user_id,
      email: user.email,
      role: user.role,
      club_id: user.club_id,
    };
    const access_token = await this.jwtService.signAsync(payload);

    // Remove password hash from response
    delete user.password_hash;

    this.logger.log(`User logged in: ${user.email}`);
    return { access_token, user };
  }

  async validateUser(userId: string): Promise<User> {
    return await this.usersService.findOne(userId);
  }
}
