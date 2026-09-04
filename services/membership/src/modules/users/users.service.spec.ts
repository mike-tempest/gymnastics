import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { User, UserRole } from './entities/user.entity';

jest.mock('bcrypt');

describe('UsersService', () => {
  let service: UsersService;
  let _repository: UsersRepository;

  const mockUser = {
    user_id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'jane.smith@example.com',
    first_name: 'Jane',
    last_name: 'Smith',
    role: UserRole.SUPER_ADMIN,
    active: true,
    family_id: null,
    password_hash: 'hashed_password',
    last_login: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockRepository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByEmail: jest.fn(),
    findByEmailInsensitive: jest.fn(),
    findByRole: jest.fn(),
    findByFamily: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    updateLastLogin: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: UsersRepository, useValue: mockRepository }],
    }).compile();

    service = module.get<UsersService>(UsersService);
    _repository = module.get<UsersRepository>(UsersRepository);

    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a user and hash the password', async () => {
      const createUserDto = {
        email: 'jane.smith@example.com',
        password: 'securePassword123',
        first_name: 'Jane',
        last_name: 'Smith',
        role: UserRole.SUPER_ADMIN,
      };

      mockRepository.findByEmail.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue({ ...mockUser });

      const result = await service.create(createUserDto);

      expect(result).toBeDefined();
      expect(result.password_hash).toBeUndefined();
      expect(bcrypt.hash).toHaveBeenCalledWith('securePassword123', 10);
      expect(mockRepository.create).toHaveBeenCalledWith(createUserDto, 'hashed_password');
    });

    it('should throw ConflictException if email already exists', async () => {
      const createUserDto = {
        email: 'jane.smith@example.com',
        password: 'securePassword123',
        first_name: 'Jane',
        last_name: 'Smith',
        role: UserRole.SUPER_ADMIN,
      };

      mockRepository.findByEmail.mockResolvedValue(mockUser);

      await expect(service.create(createUserDto)).rejects.toThrow(ConflictException);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('bulkCreateStaff', () => {
    const staffItems = [
      {
        email: 'head.coach@example.com',
        first_name: 'Helen',
        last_name: 'Carter',
        role: UserRole.HEAD_COACH,
      },
      {
        email: 'treasurer@example.com',
        first_name: 'Tom',
        last_name: 'Bailey',
        role: UserRole.TREASURER,
      },
    ];

    beforeEach(() => {
      mockRepository.findByEmail.mockResolvedValue(null);
      mockRepository.findByEmailInsensitive.mockResolvedValue(null);
      mockRepository.create.mockImplementation((dto: { email: string; role: UserRole }) =>
        Promise.resolve({
          ...mockUser,
          email: dto.email,
          role: dto.role,
          password_hash: 'hashed_password',
        }),
      );
    });

    it('should create all valid staff users with generated passwords', async () => {
      const result = await service.bulkCreateStaff([...staffItems]);

      expect(result.created).toHaveLength(2);
      expect(result.errors).toEqual([]);
      expect(result.created[0].role).toBe(UserRole.HEAD_COACH);
      expect(result.created[1].role).toBe(UserRole.TREASURER);
      expect(mockRepository.create).toHaveBeenCalledTimes(2);
      expect(bcrypt.hash).toHaveBeenCalledTimes(2);

      const generatedPasswords = (bcrypt.hash as jest.Mock).mock.calls.map((call) => call[0]);
      generatedPasswords.forEach((password) => {
        expect(typeof password).toBe('string');
        expect(password.length).toBeGreaterThanOrEqual(32);
      });
      expect(generatedPasswords[0]).not.toBe(generatedPasswords[1]);
    });

    it('should never include the plaintext password in the response', async () => {
      const result = await service.bulkCreateStaff([staffItems[0]]);

      const generatedPassword = (bcrypt.hash as jest.Mock).mock.calls[0][0];
      const serialised = JSON.stringify(result);

      expect(serialised).not.toContain(generatedPassword);
      expect(result.created[0].password_hash).toBeUndefined();
      expect(result.created[0]).not.toHaveProperty('password');
    });

    it('should reject non-staff roles as row errors without aborting the batch', async () => {
      const result = await service.bulkCreateStaff([
        {
          email: 'admin@example.com',
          first_name: 'Alice',
          last_name: 'Nguyen',
          role: UserRole.SUPER_ADMIN,
        },
        staffItems[0],
        {
          email: 'parent@example.com',
          first_name: 'Priya',
          last_name: 'Shah',
          role: UserRole.PARENT,
        },
      ]);

      expect(result.created).toHaveLength(1);
      expect(result.created[0].email).toBe('head.coach@example.com');
      expect(result.errors).toEqual([
        { row: 1, message: 'Role super_admin is not a staff role' },
        { row: 3, message: 'Role parent is not a staff role' },
      ]);
      expect(mockRepository.create).toHaveBeenCalledTimes(1);
    });

    it('should reject duplicate emails within the payload case-insensitively', async () => {
      const result = await service.bulkCreateStaff([
        staffItems[0],
        { ...staffItems[1], email: 'Head.Coach@Example.com' },
      ]);

      expect(result.created).toHaveLength(1);
      expect(result.errors).toEqual([
        { row: 2, message: 'Duplicate email in payload: head.coach@example.com' },
      ]);
      expect(mockRepository.create).toHaveBeenCalledTimes(1);
    });

    it('should report an existing user email as a row error and continue', async () => {
      mockRepository.findByEmailInsensitive.mockImplementation((email: string) =>
        Promise.resolve(email === 'head.coach@example.com' ? { ...mockUser } : null),
      );

      const result = await service.bulkCreateStaff([...staffItems]);

      expect(result.created).toHaveLength(1);
      expect(result.created[0].email).toBe('treasurer@example.com');
      expect(result.errors).toEqual([
        { row: 1, message: 'User with this email already exists' },
      ]);
    });

    it('should detect an existing user case-insensitively', async () => {
      mockRepository.findByEmailInsensitive.mockResolvedValue({
        ...mockUser,
        email: 'Head.Coach@Example.com',
      });

      const result = await service.bulkCreateStaff([staffItems[0]]);

      expect(result.created).toHaveLength(0);
      expect(result.errors).toEqual([
        { row: 1, message: 'User with this email already exists' },
      ]);
      expect(mockRepository.findByEmailInsensitive).toHaveBeenCalledWith(
        'head.coach@example.com',
      );
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should support partial success across mixed valid and invalid rows', async () => {
      mockRepository.findByEmailInsensitive.mockImplementation((email: string) =>
        Promise.resolve(email === 'existing@example.com' ? { ...mockUser } : null),
      );

      const result = await service.bulkCreateStaff([
        staffItems[0],
        {
          email: 'swimmer@example.com',
          first_name: 'Sam',
          last_name: 'Young',
          role: UserRole.SWIMMER_ADULT,
        },
        {
          email: 'existing@example.com',
          first_name: 'Erin',
          last_name: 'Woods',
          role: UserRole.WELFARE_OFFICER,
        },
        staffItems[1],
      ]);

      expect(result.created).toHaveLength(2);
      expect(result.created.map((user) => user.email)).toEqual([
        'head.coach@example.com',
        'treasurer@example.com',
      ]);
      expect(result.errors).toEqual([
        { row: 2, message: 'Role swimmer_adult is not a staff role' },
        { row: 3, message: 'User with this email already exists' },
      ]);
    });
  });

  describe('findAll', () => {
    it('should return all users with password hashes removed', async () => {
      const usersWithHash = [{ ...mockUser }, { ...mockUser, user_id: 'other-id' }];
      mockRepository.findAll.mockResolvedValue(usersWithHash);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      result.forEach((user) => {
        expect(user.password_hash).toBeUndefined();
      });
    });

    it('should return an empty array when no users exist', async () => {
      mockRepository.findAll.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a user without password hash', async () => {
      mockRepository.findOne.mockResolvedValue({ ...mockUser });

      const result = await service.findOne(mockUser.user_id);

      expect(result.user_id).toBe(mockUser.user_id);
      expect(result.password_hash).toBeUndefined();
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByEmail', () => {
    it('should return the user for a matching email', async () => {
      mockRepository.findByEmail.mockResolvedValue(mockUser);

      const result = await service.findByEmail('jane.smith@example.com');

      expect(result).toEqual(mockUser);
      expect(mockRepository.findByEmail).toHaveBeenCalledWith('jane.smith@example.com');
    });

    it('should return null if no user matches the email', async () => {
      mockRepository.findByEmail.mockResolvedValue(null);

      const result = await service.findByEmail('unknown@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findByRole', () => {
    it('should return users with the specified role, passwords removed', async () => {
      mockRepository.findByRole.mockResolvedValue([{ ...mockUser }]);

      const result = await service.findByRole(UserRole.SUPER_ADMIN);

      expect(result).toHaveLength(1);
      expect(result[0].password_hash).toBeUndefined();
      expect(mockRepository.findByRole).toHaveBeenCalledWith(UserRole.SUPER_ADMIN);
    });
  });

  describe('findByFamily', () => {
    it('should return users belonging to a family, passwords removed', async () => {
      const familyId = '334e5678-e89b-12d3-a456-426614174002';
      mockRepository.findByFamily.mockResolvedValue([{ ...mockUser, family_id: familyId }]);

      const result = await service.findByFamily(familyId);

      expect(result).toHaveLength(1);
      expect(result[0].password_hash).toBeUndefined();
    });
  });

  describe('update', () => {
    it('should update a user and remove password hash from response', async () => {
      const updateDto = { first_name: 'Janet' };
      const updatedUser = { ...mockUser, first_name: 'Janet' };

      mockRepository.findOne.mockResolvedValue({ ...mockUser });
      mockRepository.update.mockResolvedValue({ ...updatedUser });

      const result = await service.update(mockUser.user_id, updateDto);

      expect(result.first_name).toBe('Janet');
      expect(result.password_hash).toBeUndefined();
    });

    it('should hash a new password if provided in the update', async () => {
      const updateDto = { password: 'newPassword456' };

      mockRepository.findOne.mockResolvedValue({ ...mockUser });
      mockRepository.update.mockResolvedValue({ ...mockUser });

      await service.update(mockUser.user_id, updateDto);

      expect(bcrypt.hash).toHaveBeenCalledWith('newPassword456', 10);
      expect(mockRepository.update).toHaveBeenCalledWith(
        mockUser.user_id,
        expect.not.objectContaining({ password: expect.anything() }),
        'hashed_password',
      );
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.update('non-existent-id', { first_name: 'Janet' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should remove a user', async () => {
      mockRepository.findOne.mockResolvedValue({ ...mockUser });
      mockRepository.remove.mockResolvedValue(undefined);

      await service.remove(mockUser.user_id);

      expect(mockRepository.remove).toHaveBeenCalledWith(mockUser.user_id);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('validatePassword', () => {
    it('should return true for a correct password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validatePassword(
        mockUser as unknown as User,
        'securePassword123',
      );

      expect(result).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith('securePassword123', 'hashed_password');
    });

    it('should return false for an incorrect password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validatePassword(mockUser as unknown as User, 'wrongpassword');

      expect(result).toBe(false);
    });

    it('should return false if user has no password hash', async () => {
      const userWithoutHash = { ...mockUser, password_hash: undefined };

      const result = await service.validatePassword(
        userWithoutHash as unknown as User,
        'anypassword',
      );

      expect(result).toBe(false);
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });
  });

  describe('updateLastLogin', () => {
    it('should call repository updateLastLogin with the user ID', async () => {
      mockRepository.updateLastLogin.mockResolvedValue(undefined);

      await service.updateLastLogin(mockUser.user_id);

      expect(mockRepository.updateLastLogin).toHaveBeenCalledWith(mockUser.user_id);
    });
  });
});
