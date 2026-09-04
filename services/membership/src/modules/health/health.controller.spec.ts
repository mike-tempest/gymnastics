import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService, TypeOrmHealthIndicator, HealthCheckResult } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { GoCardlessHealthIndicator } from './gocardless.health';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: HealthCheckService;

  const mockHealthCheckService = {
    check: jest.fn(),
  };

  const mockTypeOrmHealthIndicator = {
    pingCheck: jest.fn(),
  };

  const mockGoCardlessHealthIndicator = {
    isHealthy: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealthCheckService },
        { provide: TypeOrmHealthIndicator, useValue: mockTypeOrmHealthIndicator },
        { provide: GoCardlessHealthIndicator, useValue: mockGoCardlessHealthIndicator },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthCheckService = module.get<HealthCheckService>(HealthCheckService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return ok status when all checks pass', async () => {
    const expectedResult: HealthCheckResult = {
      status: 'ok',
      info: {
        database: { status: 'up' },
        gocardless: { status: 'up' },
      },
      error: {},
      details: {
        database: { status: 'up' },
        gocardless: { status: 'up' },
      },
    };

    mockHealthCheckService.check.mockResolvedValue(expectedResult);

    const result = await controller.check();

    expect(result).toEqual(expectedResult);
    expect(healthCheckService.check).toHaveBeenCalledWith(
      expect.arrayContaining([expect.any(Function)]),
    );
  });

  it('should return error status when database is down', async () => {
    const expectedResult: HealthCheckResult = {
      status: 'error',
      info: {
        gocardless: { status: 'up' },
      },
      error: {
        database: { status: 'down', message: 'Connection refused' },
      },
      details: {
        gocardless: { status: 'up' },
        database: { status: 'down', message: 'Connection refused' },
      },
    };

    mockHealthCheckService.check.mockResolvedValue(expectedResult);

    const result = await controller.check();

    expect(result.status).toBe('error');
    expect(result.error?.database).toBeDefined();
  });

  it('should pass two health indicator functions to check', async () => {
    mockHealthCheckService.check.mockResolvedValue({
      status: 'ok',
      info: {},
      error: {},
      details: {},
    });

    await controller.check();

    expect(mockHealthCheckService.check).toHaveBeenCalledTimes(1);
    const indicators = mockHealthCheckService.check.mock.calls[0][0];
    expect(indicators).toHaveLength(2);
  });
});
