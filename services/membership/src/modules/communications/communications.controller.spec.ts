import { Test, TestingModule } from '@nestjs/testing';
import { CommunicationsController } from './communications.controller';
import { CommunicationsService } from './communications.service';
import { CreateCommunicationDto } from './dto/create-communication.dto';
import { RecipientType } from './entities/communication.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

describe('CommunicationsController', () => {
  let controller: CommunicationsController;

  const mockCommunication = {
    communication_id: '123e4567-e89b-12d3-a456-426614174000',
    subject: 'Training cancelled this Saturday',
    body: 'Due to a gala, Saturday training is cancelled.',
    recipient_type: RecipientType.ALL,
    squad_id: null,
    family_id: null,
    recipient_count: 12,
    sent_date: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommunicationsController],
      providers: [
        {
          provide: CommunicationsService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<CommunicationsController>(CommunicationsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /communications', () => {
    it('should create a communication', async () => {
      const createDto: CreateCommunicationDto = {
        subject: 'Training cancelled this Saturday',
        body: 'Due to a gala, Saturday training is cancelled.',
        recipientType: RecipientType.ALL,
      };

      mockService.create.mockResolvedValue(mockCommunication);

      const result = await controller.create(createDto);

      expect(result).toEqual(mockCommunication);
      expect(mockService.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('GET /communications', () => {
    it('should return all communications', async () => {
      const communications = [mockCommunication];
      mockService.findAll.mockResolvedValue(communications);

      const result = await controller.findAll();

      expect(result).toEqual(communications);
      expect(mockService.findAll).toHaveBeenCalled();
    });
  });

  describe('GET /communications/:id', () => {
    it('should return a single communication by ID', async () => {
      mockService.findOne.mockResolvedValue(mockCommunication);

      const result = await controller.findOne(mockCommunication.communication_id);

      expect(result).toEqual(mockCommunication);
      expect(mockService.findOne).toHaveBeenCalledWith(mockCommunication.communication_id);
    });
  });

  describe('guard and role decorators', () => {
    it('should have JwtAuthGuard and RolesGuard applied at the controller level', () => {
      const guards = Reflect.getMetadata('__guards__', CommunicationsController);
      expect(guards).toBeDefined();
      expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
    });

    it('should restrict create to SUPER_ADMIN and HEAD_COACH roles', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, CommunicationsController.prototype.create);
      expect(roles).toBeDefined();
      expect(roles).toEqual(expect.arrayContaining([UserRole.SUPER_ADMIN, UserRole.HEAD_COACH]));
    });
  });
});
