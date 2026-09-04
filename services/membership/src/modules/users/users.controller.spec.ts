import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User, UserRole } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { BulkCreateStaffDto } from './dto/bulk-create-staff.dto';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';

describe('UsersController', () => {
  let controller: UsersController;
  let _service: jest.Mocked<UsersService>;

  const mockUser = {
    user_id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'jane.smith@example.com',
    first_name: 'Jane',
    last_name: 'Smith',
    role: UserRole.SUPER_ADMIN,
    active: true,
    family_id: null,
    last_login: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockUsersService = {
    create: jest.fn(),
    bulkCreateStaff: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByEmail: jest.fn(),
    findByRole: jest.fn(),
    findByFamily: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    _service = module.get(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call usersService.create and return the result', async () => {
      const createDto = {
        email: 'jane.smith@example.com',
        password: 'securePassword123',
        first_name: 'Jane',
        last_name: 'Smith',
        role: UserRole.SUPER_ADMIN,
      };

      mockUsersService.create.mockResolvedValue(mockUser as unknown as User);

      const result = await controller.create(createDto as CreateUserDto);

      expect(result).toEqual(mockUser);
      expect(mockUsersService.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('bulkCreateStaff', () => {
    it('should call usersService.bulkCreateStaff with the users array', async () => {
      const bulkDto: BulkCreateStaffDto = {
        users: [
          {
            email: 'head.coach@example.com',
            first_name: 'Helen',
            last_name: 'Carter',
            role: UserRole.HEAD_COACH,
          },
        ],
      };
      const bulkResult = {
        created: [{ ...mockUser, email: 'head.coach@example.com', role: UserRole.HEAD_COACH }],
        errors: [],
      };

      mockUsersService.bulkCreateStaff.mockResolvedValue(bulkResult);

      const result = await controller.bulkCreateStaff(bulkDto);

      expect(result).toEqual(bulkResult);
      expect(mockUsersService.bulkCreateStaff).toHaveBeenCalledWith(bulkDto.users);
    });

    it('should be restricted to super admins only', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, UsersController.prototype.bulkCreateStaff);

      expect(roles).toEqual([UserRole.SUPER_ADMIN]);
    });
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      mockUsersService.findAll.mockResolvedValue([mockUser as unknown as User]);

      const result = await controller.findAll();

      expect(result).toEqual([mockUser]);
    });
  });

  describe('findByRole', () => {
    it('should return users with the specified role', async () => {
      mockUsersService.findByRole.mockResolvedValue([mockUser as unknown as User]);

      const result = await controller.findByRole(UserRole.SUPER_ADMIN);

      expect(result).toEqual([mockUser]);
      expect(mockUsersService.findByRole).toHaveBeenCalledWith(UserRole.SUPER_ADMIN);
    });
  });

  describe('findByFamily', () => {
    it('should return users belonging to a family', async () => {
      const familyId = '334e5678-e89b-12d3-a456-426614174002';
      mockUsersService.findByFamily.mockResolvedValue([mockUser as unknown as User]);

      const result = await controller.findByFamily(familyId);

      expect(result).toEqual([mockUser]);
      expect(mockUsersService.findByFamily).toHaveBeenCalledWith(familyId);
    });
  });

  describe('findOne', () => {
    it('should return a single user', async () => {
      mockUsersService.findOne.mockResolvedValue(mockUser as unknown as User);

      const result = await controller.findOne(mockUser.user_id);

      expect(result).toEqual(mockUser);
      expect(mockUsersService.findOne).toHaveBeenCalledWith(mockUser.user_id);
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const updateDto = { first_name: 'Janet' };
      const updated = { ...mockUser, first_name: 'Janet' };

      mockUsersService.update.mockResolvedValue(updated as unknown as User);

      const result = await controller.update(mockUser.user_id, updateDto as UpdateUserDto);

      expect(result.first_name).toBe('Janet');
    });
  });

  describe('remove', () => {
    it('should remove a user', async () => {
      mockUsersService.remove.mockResolvedValue(undefined);

      await controller.remove(mockUser.user_id);

      expect(mockUsersService.remove).toHaveBeenCalledWith(mockUser.user_id);
    });
  });
});
