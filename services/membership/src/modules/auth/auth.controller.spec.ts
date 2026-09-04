import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let _authService: jest.Mocked<AuthService>;

  const mockUser = {
    user_id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'jane.smith@example.com',
    first_name: 'Jane',
    last_name: 'Smith',
    role: 'admin',
    active: true,
  };

  const mockAuthService = {
    register: jest.fn(),
    registerClub: jest.fn(),
    login: jest.fn(),
    validateUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
    _authService = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should call authService.register and return the result', async () => {
      const registerDto = {
        email: 'jane.smith@example.com',
        password: 'securePassword123',
        first_name: 'Jane',
        last_name: 'Smith',
      };
      const expectedResult = { access_token: 'token123', user: mockUser };

      mockAuthService.register.mockResolvedValue(expectedResult);

      const result = await controller.register(registerDto as RegisterDto);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
    });
  });

  describe('registerClub', () => {
    it('should call authService.registerClub and return the result', async () => {
      const dto = {
        club: { name: 'Whitby Seals' },
        admin: {
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane.smith@example.com',
          password: 'securePassword123',
        },
      };
      const expectedResult = { access_token: 'token123', user: mockUser };

      mockAuthService.registerClub.mockResolvedValue(expectedResult);

      const result = await controller.registerClub(dto as never);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.registerClub).toHaveBeenCalledWith(dto);
    });
  });

  describe('login', () => {
    it('should call authService.login and return the result', async () => {
      const loginDto = {
        email: 'jane.smith@example.com',
        password: 'securePassword123',
      };
      const expectedResult = { access_token: 'token123', user: mockUser };

      mockAuthService.login.mockResolvedValue(expectedResult);

      const req = {
        ip: '10.0.0.1',
        headers: { 'user-agent': 'jest', 'x-forwarded-for': '203.0.113.7, 10.0.0.1' },
      };

      const result = await controller.login(loginDto as LoginDto, req);

      expect(result).toEqual(expectedResult);
      // The forwarded client IP is preferred over the internal socket address,
      // since the service sits behind Railway's load balancer.
      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto, {
        ipAddress: '203.0.113.7',
        userAgent: 'jest',
      });
    });

    it('falls back to the socket address when there is no forwarded header', async () => {
      const loginDto = { email: 'jane.smith@example.com', password: 'securePassword123' };
      mockAuthService.login.mockResolvedValue({ access_token: 'token123', user: mockUser });

      await controller.login(loginDto as LoginDto, { ip: '10.0.0.1', headers: {} });

      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto, {
        ipAddress: '10.0.0.1',
        userAgent: undefined,
      });
    });
  });

  describe('getProfile', () => {
    it('should return the authenticated user from the request', () => {
      const mockRequest = { user: mockUser };

      const result = controller.getProfile(mockRequest);

      expect(result).toEqual(mockUser);
    });
  });
});
