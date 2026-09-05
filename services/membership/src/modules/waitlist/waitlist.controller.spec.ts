import { Test, TestingModule } from '@nestjs/testing';
import { WaitlistController } from './waitlist.controller';
import { WaitlistService } from './waitlist.service';
import { CreateWaitlistDto } from './dto/create-waitlist.dto';

describe('WaitlistController', () => {
  let controller: WaitlistController;

  const mockWaitlistService = {
    create: jest.fn(),
    count: jest.fn(),
    findAll: jest.fn(),
    processDrips: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WaitlistController],
      providers: [
        {
          provide: WaitlistService,
          useValue: mockWaitlistService,
        },
      ],
    }).compile();

    controller = module.get<WaitlistController>(WaitlistController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('join (POST /waitlist)', () => {
    it('should call service.create with the provided DTO', async () => {
      const dto: CreateWaitlistDto = {
        email: 'parent@example.com',
        name: 'Test Parent',
        clubName: 'City Members',
      };
      const expected = { success: true, message: 'Thanks! We will be in touch.' };
      mockWaitlistService.create.mockResolvedValue(expected);

      const result = await controller.join(dto);

      expect(result).toEqual(expected);
      expect(mockWaitlistService.create).toHaveBeenCalledWith(dto);
    });

    it('should have the @Public() decorator', () => {
      const metadata = Reflect.getMetadata('isPublic', WaitlistController.prototype.join);
      expect(metadata).toBe(true);
    });
  });

  describe('getCount (GET /waitlist/count)', () => {
    it('should return the count wrapped in an object', async () => {
      mockWaitlistService.count.mockResolvedValue(57);

      const result = await controller.getCount();

      expect(result).toEqual({ count: 57 });
      expect(mockWaitlistService.count).toHaveBeenCalled();
    });

    it('should have the @Public() decorator', () => {
      const metadata = Reflect.getMetadata('isPublic', WaitlistController.prototype.getCount);
      expect(metadata).toBe(true);
    });
  });

  describe('findAll (GET /waitlist)', () => {
    it('should call service.findAll and return all entries', async () => {
      const entries = [{ id: '1', email: 'a@b.com' }];
      mockWaitlistService.findAll.mockResolvedValue(entries);

      const result = await controller.findAll();

      expect(result).toEqual(entries);
      expect(mockWaitlistService.findAll).toHaveBeenCalled();
    });

    it('should not have the @Public() decorator (requires authentication)', () => {
      const metadata = Reflect.getMetadata('isPublic', WaitlistController.prototype.findAll);
      expect(metadata).toBeUndefined();
    });
  });

  describe('processDrips (POST /waitlist/process-drips)', () => {
    it('should call service.processDrips and return the result', async () => {
      const expected = { sent: 5 };
      mockWaitlistService.processDrips.mockResolvedValue(expected);

      const result = await controller.processDrips();

      expect(result).toEqual(expected);
      expect(mockWaitlistService.processDrips).toHaveBeenCalled();
    });

    it('should not have the @Public() decorator (requires authentication)', () => {
      const metadata = Reflect.getMetadata('isPublic', WaitlistController.prototype.processDrips);
      expect(metadata).toBeUndefined();
    });
  });
});
