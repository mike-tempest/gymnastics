import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { AuditLogsService } from '../compliance/audit-logs/audit-logs.service';
import { RegisterDto } from './dto/register.dto';
import { RegisterClubDto } from './dto/register-club.dto';
import { LoginDto } from './dto/login.dto';
import { UserRole } from '../users/entities/user.entity';
import { Club } from '../clubs/entities/club.entity';
import { ClubSettings } from '../admin/settings/club-settings.entity';
import { User } from '../users/entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let _usersService: jest.Mocked<UsersService>;
  let _jwtService: jest.Mocked<JwtService>;
  let _emailService: jest.Mocked<EmailService>;

  const mockUser = {
    user_id: '123e4567-e89b-12d3-a456-426614174000',
    club_id: 'club-123e4567-e89b-12d3-a456-426614174999',
    email: 'jane.smith@example.com',
    first_name: 'Jane',
    last_name: 'Smith',
    role: 'admin',
    active: true,
    password_hash: 'hashed_password',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockUsersService = {
    create: jest.fn(),
    findByEmail: jest.fn(),
    findOne: jest.fn(),
    validatePassword: jest.fn(),
    updateLastLogin: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
  };

  const mockEmailService = {
    sendWelcome: jest.fn(),
    sendNewClubSignupAlert: jest.fn().mockResolvedValue(undefined),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('http://localhost:3000'),
  };

  // ---------------------------------------------------------------------------
  // Fake in-memory DataSource for registerClub transaction tests.
  //
  // dataSource.transaction(cb) runs cb against a manager whose getRepository()
  // returns per-entity repos backed by simple arrays. A repo can be told to
  // throw on save() to exercise the rollback path; rollback is verified by
  // asserting nothing persisted to the shared stores.
  // ---------------------------------------------------------------------------
  type Store = {
    clubs: any[];
    users: any[];
    settings: any[];
  };

  let store: Store;
  let failSettingsSave: boolean;
  let existingEmails: string[];

  const makeRepo = (entity: unknown, coll: any[], opts: { failSave?: boolean } = {}) => ({
    findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
      const [[key, value]] = Object.entries(where);
      const found = coll.find((row) => row[key] === value);
      return found ?? null;
    }),
    create: jest.fn((data: Record<string, unknown>) => ({ ...data })),
    save: jest.fn(async (data: Record<string, unknown>) => {
      if (opts.failSave) {
        throw new Error('Simulated DB failure on save');
      }
      const row = {
        ...data,
        id: data.id ?? `id-${coll.length + 1}`,
        user_id: data.user_id ?? `user-${coll.length + 1}`,
        settings_id: data.settings_id ?? `settings-${coll.length + 1}`,
      };
      // Snapshot what was persisted (the prod DB row would be immutable from
      // the service's POV); return the live row reference so the service can
      // still mutate it (e.g. delete password_hash from the response) without
      // affecting what the test sees as "what got stored".
      coll.push({ ...row });
      return row;
    }),
  });

  const mockDataSource = {
    transaction: jest.fn(async (cb: (manager: unknown) => Promise<unknown>) => {
      // committedStore mirrors what would survive a commit; we only merge the
      // working stores into the shared `store` if the callback resolves.
      const workingClubs: any[] = [];
      const workingUsers: any[] = existingEmails.map((email) => ({ email }));
      const workingSettings: any[] = [];

      const userRepo = makeRepo(User, workingUsers);
      const clubRepo = makeRepo(Club, workingClubs);
      const settingsRepo = makeRepo(ClubSettings, workingSettings, {
        failSave: failSettingsSave,
      });

      const manager = {
        getRepository: (entity: unknown) => {
          if (entity === Club) return clubRepo;
          if (entity === User) return userRepo;
          if (entity === ClubSettings) return settingsRepo;
          throw new Error('Unexpected entity in transaction');
        },
      };

      try {
        const result = await cb(manager);
        // Commit: publish working rows (minus the seeded existing users).
        store.clubs.push(...workingClubs);
        store.users.push(...workingUsers.filter((u) => !existingEmails.includes(u.email)));
        store.settings.push(...workingSettings);
        return result;
      } catch (err) {
        // Rollback: discard everything by simply not publishing.
        throw err;
      }
    }),
  };

  // Audit writes are best-effort side effects of login/signup: they resolve so
  // the happy path is unaffected, and are asserted on separately below.
  const mockAuditLogsService = {
    logLogin: jest.fn().mockResolvedValue(undefined),
    logLogout: jest.fn().mockResolvedValue(undefined),
    logClubSignup: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    store = { clubs: [], users: [], settings: [] };
    failSettingsSave = false;
    existingEmails = [];

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AuditLogsService, useValue: mockAuditLogsService },
        { provide: getDataSourceToken(), useValue: mockDataSource as unknown as DataSource },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    _usersService = module.get(UsersService);
    _jwtService = module.get(JwtService);
    _emailService = module.get(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user and return access token', async () => {
      const registerDto: RegisterDto = {
        email: 'jane.smith@example.com',
        password: 'securePassword123',
        first_name: 'Jane',
        last_name: 'Smith',
      };

      mockUsersService.create.mockResolvedValue(mockUser);
      mockJwtService.signAsync.mockResolvedValue('mock_access_token');
      mockEmailService.sendWelcome.mockResolvedValue(undefined);

      const result = await service.register(registerDto);

      expect(result.access_token).toBe('mock_access_token');
      expect(result.user).toEqual(mockUser);
      // No role supplied -> defaults to PARENT after mapping.
      expect(mockUsersService.create).toHaveBeenCalledWith({
        ...registerDto,
        role: UserRole.PARENT,
      });
      expect(mockJwtService.signAsync).toHaveBeenCalledWith({
        sub: mockUser.user_id,
        email: mockUser.email,
        role: mockUser.role,
        club_id: mockUser.club_id,
      });
    });

    it('should map an uppercase frontend role to the lowercase enum', async () => {
      const registerDto = {
        email: 'coach@example.com',
        password: 'securePassword123',
        first_name: 'Coach',
        last_name: 'Carter',
        role: 'COACH' as unknown as UserRole,
      };

      mockUsersService.create.mockResolvedValue(mockUser);
      mockJwtService.signAsync.mockResolvedValue('mock_access_token');
      mockEmailService.sendWelcome.mockResolvedValue(undefined);

      await service.register(registerDto as RegisterDto);

      expect(mockUsersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.SQUAD_COACH }),
      );
    });

    it('should map ADMIN to super_admin and PARENT to parent', async () => {
      mockUsersService.create.mockResolvedValue(mockUser);
      mockJwtService.signAsync.mockResolvedValue('mock_access_token');
      mockEmailService.sendWelcome.mockResolvedValue(undefined);

      await service.register({
        email: 'admin@example.com',
        password: 'securePassword123',
        first_name: 'Ada',
        last_name: 'Min',
        role: 'ADMIN' as unknown as UserRole,
      });
      expect(mockUsersService.create).toHaveBeenLastCalledWith(
        expect.objectContaining({ role: UserRole.SUPER_ADMIN }),
      );

      await service.register({
        email: 'parent@example.com',
        password: 'securePassword123',
        first_name: 'Pat',
        last_name: 'Rent',
        role: 'PARENT' as unknown as UserRole,
      });
      expect(mockUsersService.create).toHaveBeenLastCalledWith(
        expect.objectContaining({ role: UserRole.PARENT }),
      );
    });

    it('should send a welcome email after registration', async () => {
      const registerDto: RegisterDto = {
        email: 'jane.smith@example.com',
        password: 'securePassword123',
        first_name: 'Jane',
        last_name: 'Smith',
      };

      mockUsersService.create.mockResolvedValue(mockUser);
      mockJwtService.signAsync.mockResolvedValue('mock_access_token');
      mockEmailService.sendWelcome.mockResolvedValue(undefined);

      await service.register(registerDto);

      // Give non-blocking email a tick to fire
      await Promise.resolve();

      expect(mockEmailService.sendWelcome).toHaveBeenCalledWith(
        expect.objectContaining({
          email: mockUser.email,
          firstName: mockUser.first_name,
          lastName: mockUser.last_name,
        }),
      );
    });

    it('should still succeed if welcome email fails', async () => {
      const registerDto: RegisterDto = {
        email: 'jane.smith@example.com',
        password: 'securePassword123',
        first_name: 'Jane',
        last_name: 'Smith',
      };

      mockUsersService.create.mockResolvedValue(mockUser);
      mockJwtService.signAsync.mockResolvedValue('mock_access_token');
      mockEmailService.sendWelcome.mockRejectedValue(new Error('SMTP error'));

      const result = await service.register(registerDto);

      expect(result.access_token).toBe('mock_access_token');
    });
  });

  describe('registerClub', () => {
    const dto: RegisterClubDto = {
      club: {
        name: 'Whitby Seals',
        county: 'North Yorkshire',
        affiliate_number: 'SE-12345',
        contact_email: 'info@whitbyseals.example',
      },
      admin: {
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'Jane.Smith@Example.com',
        password: 'securePassword123',
      },
    };

    it('creates exactly one club, one super_admin, and one club_settings row atomically', async () => {
      mockJwtService.signAsync.mockResolvedValue('mock_access_token');
      mockEmailService.sendWelcome.mockResolvedValue(undefined);

      const result = await service.registerClub(dto);

      expect(store.clubs).toHaveLength(1);
      expect(store.users).toHaveLength(1);
      expect(store.settings).toHaveLength(1);

      // First user is a super_admin scoped to the new club.
      expect(store.users[0].role).toBe(UserRole.SUPER_ADMIN);
      expect(store.users[0].club_id).toBe(store.clubs[0].id);
      expect(store.users[0].password_hash).toBeDefined();
      // Email is normalised to lowercase.
      expect(store.users[0].email).toBe('jane.smith@example.com');

      // Settings row is scoped to the new club and seeded from club details.
      expect(store.settings[0].club_id).toBe(store.clubs[0].id);
      expect(store.settings[0].club_name).toBe('Whitby Seals');

      // Club has a slug derived from the name.
      expect(store.clubs[0].slug).toBe('whitby-seals');

      expect(result.access_token).toBe('mock_access_token');
    });

    it('defaults a GB signup with no governing_body to BRITISH_GYMNASTICS', async () => {
      mockJwtService.signAsync.mockResolvedValue('mock_access_token');
      mockEmailService.sendWelcome.mockResolvedValue(undefined);

      await service.registerClub(dto);

      expect(store.clubs[0].governing_body).toBe('BRITISH_GYMNASTICS');
    });

    it('defaults a US signup with no governing_body to USA_SWIMMING', async () => {
      mockJwtService.signAsync.mockResolvedValue('mock_access_token');
      mockEmailService.sendWelcome.mockResolvedValue(undefined);

      const usDto: RegisterClubDto = {
        ...dto,
        club: { ...dto.club, country: 'US' },
      };

      await service.registerClub(usDto);

      expect(store.clubs[0].governing_body).toBe('USA_SWIMMING');
    });

    it('honours a submitted governing_body valid for the country', async () => {
      mockJwtService.signAsync.mockResolvedValue('mock_access_token');
      mockEmailService.sendWelcome.mockResolvedValue(undefined);

      // Scottish Swimming is a valid GB choice alongside Swim England.
      const scotDto: RegisterClubDto = {
        ...dto,
        club: { ...dto.club, country: 'GB', governing_body: 'SCOTTISH_SWIMMING' },
      };

      await service.registerClub(scotDto);

      expect(store.clubs[0].governing_body).toBe('SCOTTISH_SWIMMING');
    });

    it('falls back to the country default when the submitted governing_body is wrong for the country', async () => {
      mockJwtService.signAsync.mockResolvedValue('mock_access_token');
      mockEmailService.sendWelcome.mockResolvedValue(undefined);

      // USA_SWIMMING is not a GB body, so the GB default (British Gymnastics) wins.
      const mismatchDto: RegisterClubDto = {
        ...dto,
        club: { ...dto.club, country: 'GB', governing_body: 'USA_SWIMMING' },
      };

      await service.registerClub(mismatchDto);

      expect(store.clubs[0].governing_body).toBe('BRITISH_GYMNASTICS');
    });

    it('maps legacy affiliate_number and swim_england_region onto the new club columns', async () => {
      mockJwtService.signAsync.mockResolvedValue('mock_access_token');
      mockEmailService.sendWelcome.mockResolvedValue(undefined);

      const legacyDto: RegisterClubDto = {
        ...dto,
        club: {
          name: 'Legacy Club',
          swim_england_region: 'North East',
          affiliate_number: 'SE-99999',
        },
      };

      await service.registerClub(legacyDto);

      expect(store.clubs[0].governing_body_region).toBe('North East');
      expect(store.clubs[0].affiliation_number).toBe('SE-99999');
    });

    it('prefers the new affiliation fields over the legacy ones', async () => {
      mockJwtService.signAsync.mockResolvedValue('mock_access_token');
      mockEmailService.sendWelcome.mockResolvedValue(undefined);

      const newDto: RegisterClubDto = {
        ...dto,
        club: {
          name: 'New Fields Club',
          governing_body_region: 'Midlands',
          affiliation_number: 'SE-NEW',
          swim_england_region: 'North East',
          affiliate_number: 'SE-OLD',
        },
      };

      await service.registerClub(newDto);

      expect(store.clubs[0].governing_body_region).toBe('Midlands');
      expect(store.clubs[0].affiliation_number).toBe('SE-NEW');
    });

    it('no longer writes the legacy swim_england club columns or the settings JSONB key', async () => {
      mockJwtService.signAsync.mockResolvedValue('mock_access_token');
      mockEmailService.sendWelcome.mockResolvedValue(undefined);

      await service.registerClub(dto);

      // Legacy club columns are left untouched (undefined in a fresh create).
      expect(store.clubs[0].swim_england_region).toBeUndefined();
      expect(store.clubs[0].swim_england_affiliate_number).toBeUndefined();
      // The settings row no longer stores the swim_england JSONB blob.
      expect(store.settings[0].swim_england).toBeUndefined();
    });

    it('maps the signup alert region and affiliate number from the resolved club values', async () => {
      mockJwtService.signAsync.mockResolvedValue('mock_access_token');
      mockEmailService.sendWelcome.mockResolvedValue(undefined);

      const legacyDto: RegisterClubDto = {
        ...dto,
        club: {
          name: 'Alert Club',
          swim_england_region: 'South West',
          affiliate_number: 'SE-ALERT',
        },
      };

      await service.registerClub(legacyDto);
      await Promise.resolve();

      expect(mockEmailService.sendNewClubSignupAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'South West',
          affiliateNumber: 'SE-ALERT',
        }),
      );
    });

    it('defaults a UK signup with no country/currency to GB/GBP', async () => {
      mockJwtService.signAsync.mockResolvedValue('mock_access_token');
      mockEmailService.sendWelcome.mockResolvedValue(undefined);

      await service.registerClub(dto);

      // Existing UK clubs are unchanged: GB country, GBP currency.
      expect(store.clubs[0].country).toBe('GB');
      expect(store.clubs[0].currency).toBe('GBP');
    });

    it('derives the currency from the country when only a country is given', async () => {
      mockJwtService.signAsync.mockResolvedValue('mock_access_token');
      mockEmailService.sendWelcome.mockResolvedValue(undefined);

      const usDto: RegisterClubDto = {
        ...dto,
        club: { ...dto.club, country: 'US' },
      };

      await service.registerClub(usDto);

      expect(store.clubs[0].country).toBe('US');
      expect(store.clubs[0].currency).toBe('USD');
    });

    it('uses an explicitly supplied currency over the country default', async () => {
      mockJwtService.signAsync.mockResolvedValue('mock_access_token');
      mockEmailService.sendWelcome.mockResolvedValue(undefined);

      const explicitDto: RegisterClubDto = {
        ...dto,
        club: { ...dto.club, country: 'IE', currency: 'GBP' },
      };

      await service.registerClub(explicitDto);

      expect(store.clubs[0].country).toBe('IE');
      expect(store.clubs[0].currency).toBe('GBP');
    });

    it('defaults timezone and locale from the country when absent', async () => {
      mockJwtService.signAsync.mockResolvedValue('mock_access_token');
      mockEmailService.sendWelcome.mockResolvedValue(undefined);

      // No timezone or locale supplied: a GB signup stays on UK defaults.
      await service.registerClub(dto);

      expect(store.clubs[0].timezone).toBe('Europe/London');
      expect(store.clubs[0].locale).toBe('en-GB');
    });

    it('defaults a US signup to the US default timezone and locale', async () => {
      mockJwtService.signAsync.mockResolvedValue('mock_access_token');
      mockEmailService.sendWelcome.mockResolvedValue(undefined);

      const usDto: RegisterClubDto = {
        ...dto,
        club: { ...dto.club, country: 'US' },
      };

      await service.registerClub(usDto);

      expect(store.clubs[0].timezone).toBe('America/New_York');
      expect(store.clubs[0].locale).toBe('en-US');
    });

    it('keeps a submitted timezone that is valid for the country', async () => {
      mockJwtService.signAsync.mockResolvedValue('mock_access_token');
      mockEmailService.sendWelcome.mockResolvedValue(undefined);

      const usDto: RegisterClubDto = {
        ...dto,
        club: { ...dto.club, country: 'US', timezone: 'America/Los_Angeles' },
      };

      await service.registerClub(usDto);

      expect(store.clubs[0].timezone).toBe('America/Los_Angeles');
    });

    it('replaces a timezone that is invalid for the country with the country default', async () => {
      mockJwtService.signAsync.mockResolvedValue('mock_access_token');
      mockEmailService.sendWelcome.mockResolvedValue(undefined);

      // Europe/London is not a valid AU choice, so the AU default wins.
      const auDto: RegisterClubDto = {
        ...dto,
        club: { ...dto.club, country: 'AU', timezone: 'Europe/London' },
      };

      await service.registerClub(auDto);

      expect(store.clubs[0].timezone).toBe('Australia/Sydney');
      expect(store.clubs[0].locale).toBe('en-AU');
    });

    it('uses an explicitly supplied locale over the country default', async () => {
      mockJwtService.signAsync.mockResolvedValue('mock_access_token');
      mockEmailService.sendWelcome.mockResolvedValue(undefined);

      const caDto: RegisterClubDto = {
        ...dto,
        club: { ...dto.club, country: 'CA', locale: 'fr-CA' },
      };

      await service.registerClub(caDto);

      expect(store.clubs[0].country).toBe('CA');
      expect(store.clubs[0].locale).toBe('fr-CA');
      // Timezone still defaults from the country when not supplied.
      expect(store.clubs[0].timezone).toBe('America/St_Johns');
    });

    it('defaults a GB signup to a VAT tax label with no tax rate', async () => {
      mockJwtService.signAsync.mockResolvedValue('mock_access_token');
      mockEmailService.sendWelcome.mockResolvedValue(undefined);

      await service.registerClub(dto);

      // Only the tax NAME is defaulted; the rate stays unset so invoices are
      // issued without tax until the club opts in via settings. This applies
      // at registration only, so existing GB clubs are untouched.
      expect(store.clubs[0].tax_label).toBe('VAT');
      expect(store.clubs[0].tax_rate).toBeUndefined();
    });

    it('defaults an AU signup to a GST tax label with no tax rate', async () => {
      mockJwtService.signAsync.mockResolvedValue('mock_access_token');
      mockEmailService.sendWelcome.mockResolvedValue(undefined);

      const auDto: RegisterClubDto = {
        ...dto,
        club: { ...dto.club, country: 'AU' },
      };

      await service.registerClub(auDto);

      // A rate default would wrongly tax clubs not registered for GST, so
      // only the label is set.
      expect(store.clubs[0].tax_label).toBe('GST');
      expect(store.clubs[0].tax_rate).toBeUndefined();
    });

    it('defaults US and CA signups to their conventional tax labels', async () => {
      mockJwtService.signAsync.mockResolvedValue('mock_access_token');
      mockEmailService.sendWelcome.mockResolvedValue(undefined);

      await service.registerClub({ ...dto, club: { ...dto.club, country: 'US' } });
      expect(store.clubs[0].tax_label).toBe('Sales tax');

      await service.registerClub({
        ...dto,
        admin: { ...dto.admin, email: 'other.admin@example.com' },
        club: { ...dto.club, name: 'Maple Marlins', country: 'CA' },
      });
      expect(store.clubs[1].tax_label).toBe('GST');
    });

    it('returns a JWT payload that carries club_id', async () => {
      mockJwtService.signAsync.mockResolvedValue('mock_access_token');
      mockEmailService.sendWelcome.mockResolvedValue(undefined);

      await service.registerClub(dto);

      const payload = mockJwtService.signAsync.mock.calls[0][0];
      expect(payload).toEqual(
        expect.objectContaining({
          sub: store.users[0].user_id,
          email: 'jane.smith@example.com',
          role: UserRole.SUPER_ADMIN,
          club_id: store.clubs[0].id,
        }),
      );
    });

    it('strips the password hash from the returned user', async () => {
      mockJwtService.signAsync.mockResolvedValue('mock_access_token');
      mockEmailService.sendWelcome.mockResolvedValue(undefined);

      const result = await service.registerClub(dto);

      expect(result.user.password_hash).toBeUndefined();
      expect(result.user.role).toBe(UserRole.SUPER_ADMIN);
    });

    it('rejects with 409 if the admin email already exists', async () => {
      existingEmails = ['jane.smith@example.com'];
      mockJwtService.signAsync.mockResolvedValue('mock_access_token');

      await expect(service.registerClub(dto)).rejects.toThrow(ConflictException);

      // Nothing persisted.
      expect(store.clubs).toHaveLength(0);
      expect(store.users).toHaveLength(0);
      expect(store.settings).toHaveLength(0);
    });

    it('rolls back fully if a later step fails (no orphan club/user/settings)', async () => {
      failSettingsSave = true;
      mockJwtService.signAsync.mockResolvedValue('mock_access_token');

      await expect(service.registerClub(dto)).rejects.toThrow('Simulated DB failure on save');

      // The club and user inserts happened inside the transaction, but because
      // the settings insert threw, the transaction rolls back and NOTHING is
      // committed to the shared store.
      expect(store.clubs).toHaveLength(0);
      expect(store.users).toHaveLength(0);
      expect(store.settings).toHaveLength(0);

      // No session is issued on failure.
      expect(mockJwtService.signAsync).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should log in a valid user and return access token', async () => {
      const loginDto: LoginDto = {
        email: 'jane.smith@example.com',
        password: 'securePassword123',
      };

      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      mockUsersService.validatePassword.mockResolvedValue(true);
      mockUsersService.updateLastLogin.mockResolvedValue(undefined);
      mockJwtService.signAsync.mockResolvedValue('mock_access_token');

      const result = await service.login(loginDto);

      expect(result.access_token).toBe('mock_access_token');
      expect(result.user).toBeDefined();
      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(loginDto.email);
      expect(mockUsersService.updateLastLogin).toHaveBeenCalledWith(mockUser.user_id);
    });

    it('records the login in the audit trail with the user club and request context', async () => {
      const loginDto: LoginDto = {
        email: 'jane.smith@example.com',
        password: 'securePassword123',
      };

      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      mockUsersService.validatePassword.mockResolvedValue(true);
      mockUsersService.updateLastLogin.mockResolvedValue(undefined);
      mockJwtService.signAsync.mockResolvedValue('mock_access_token');

      await service.login(loginDto, { ipAddress: '203.0.113.7', userAgent: 'jest' });

      expect(mockAuditLogsService.logLogin).toHaveBeenCalledWith(
        mockUser.user_id,
        mockUser.email,
        mockUser.club_id,
        '203.0.113.7',
        'jest',
      );
    });

    it('still logs the user in when the audit write fails', async () => {
      const loginDto: LoginDto = {
        email: 'jane.smith@example.com',
        password: 'securePassword123',
      };

      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      mockUsersService.validatePassword.mockResolvedValue(true);
      mockUsersService.updateLastLogin.mockResolvedValue(undefined);
      mockJwtService.signAsync.mockResolvedValue('mock_access_token');
      mockAuditLogsService.logLogin.mockRejectedValueOnce(new Error('audit db down'));

      // Auditing is observability, not a gate: an outage must never lock
      // customers out of the product.
      await expect(service.login(loginDto)).resolves.toMatchObject({
        access_token: 'mock_access_token',
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const loginDto: LoginDto = {
        email: 'nonexistent@example.com',
        password: 'password',
      };

      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is incorrect', async () => {
      const loginDto: LoginDto = {
        email: 'jane.smith@example.com',
        password: 'wrongpassword',
      };

      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      mockUsersService.validatePassword.mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user account is inactive', async () => {
      const loginDto: LoginDto = {
        email: 'jane.smith@example.com',
        password: 'securePassword123',
      };

      const inactiveUser = { ...mockUser, active: false };
      mockUsersService.findByEmail.mockResolvedValue(inactiveUser);
      mockUsersService.validatePassword.mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Account is inactive');
    });

    it('should remove password hash from login response', async () => {
      const loginDto: LoginDto = {
        email: 'jane.smith@example.com',
        password: 'securePassword123',
      };

      mockUsersService.findByEmail.mockResolvedValue({ ...mockUser });
      mockUsersService.validatePassword.mockResolvedValue(true);
      mockUsersService.updateLastLogin.mockResolvedValue(undefined);
      mockJwtService.signAsync.mockResolvedValue('mock_access_token');

      const result = await service.login(loginDto);

      expect(result.user.password_hash).toBeUndefined();
    });
  });

  describe('validateUser', () => {
    it('should return the user for a valid user ID', async () => {
      mockUsersService.findOne.mockResolvedValue(mockUser);

      const result = await service.validateUser(mockUser.user_id);

      expect(result).toEqual(mockUser);
      expect(mockUsersService.findOne).toHaveBeenCalledWith(mockUser.user_id);
    });
  });
});
