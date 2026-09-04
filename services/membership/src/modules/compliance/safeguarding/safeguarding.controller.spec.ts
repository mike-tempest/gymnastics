import { Test, TestingModule } from '@nestjs/testing';
import { SafeguardingController } from './safeguarding.controller';
import { SafeguardingService } from './safeguarding.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { IncidentStatus } from './entities/incident.entity';

describe('SafeguardingController', () => {
  let controller: SafeguardingController;

  const mockChecklist = [
    {
      id: 'checklist-1',
      requirement: 'Swim England Wavepower 2024-2028 Policy Review',
      description: 'Annual review of safeguarding policies',
      completed: false,
      created_at: new Date(),
      updated_at: new Date(),
    },
  ];

  const mockOfficers = [
    {
      id: 'officer-1',
      name: 'Alex Rivers',
      role: 'Club Welfare Officer',
      email: 'welfare@example.org',
      phone: '07700 900123',
      dbs_number: '001234567890',
      dbs_expiry: new Date('2027-01-01'),
      created_at: new Date(),
      updated_at: new Date(),
    },
  ];

  const mockIncident = {
    id: 'incident-1',
    date: new Date('2026-03-15'),
    category: 'Safeguarding concern',
    summary: 'A concern was raised',
    status: IncidentStatus.OPEN,
    reported_by: 'Alex Rivers',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockSafeguardingService = {
    getChecklist: jest.fn(),
    updateChecklistItem: jest.fn(),
    getOfficers: jest.fn(),
    createOfficer: jest.fn(),
    updateOfficer: jest.fn(),
    deleteOfficer: jest.fn(),
    getIncidents: jest.fn(),
    createIncident: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SafeguardingController],
      providers: [{ provide: SafeguardingService, useValue: mockSafeguardingService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SafeguardingController>(SafeguardingController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getChecklist', () => {
    it('should return the safeguarding checklist', async () => {
      mockSafeguardingService.getChecklist.mockResolvedValue(mockChecklist);

      const result = await controller.getChecklist();

      expect(result).toEqual(mockChecklist);
      expect(mockSafeguardingService.getChecklist).toHaveBeenCalled();
    });
  });

  describe('updateChecklistItem', () => {
    it('should toggle the completed flag via the service', async () => {
      const updated = { ...mockChecklist[0], completed: true };
      mockSafeguardingService.updateChecklistItem.mockResolvedValue(updated);

      const result = await controller.updateChecklistItem('checklist-1', { completed: true });

      expect(result).toEqual(updated);
      expect(mockSafeguardingService.updateChecklistItem).toHaveBeenCalledWith('checklist-1', true);
    });
  });

  describe('getOfficers', () => {
    it('should return the list of safeguarding officers', async () => {
      mockSafeguardingService.getOfficers.mockResolvedValue(mockOfficers);

      const result = await controller.getOfficers();

      expect(result).toEqual(mockOfficers);
      expect(mockSafeguardingService.getOfficers).toHaveBeenCalled();
    });
  });

  describe('createOfficer', () => {
    it('should create an officer via the service', async () => {
      const dto = {
        name: 'Alex Rivers',
        role: 'Club Welfare Officer',
        email: 'welfare@example.org',
      };
      mockSafeguardingService.createOfficer.mockResolvedValue(mockOfficers[0]);

      const result = await controller.createOfficer(dto);

      expect(result).toEqual(mockOfficers[0]);
      expect(mockSafeguardingService.createOfficer).toHaveBeenCalledWith(dto);
    });
  });

  describe('updateOfficer', () => {
    it('should update an officer via the service', async () => {
      const dto = { role: 'Deputy Welfare Officer' };
      const updated = { ...mockOfficers[0], role: 'Deputy Welfare Officer' };
      mockSafeguardingService.updateOfficer.mockResolvedValue(updated);

      const result = await controller.updateOfficer('officer-1', dto);

      expect(result).toEqual(updated);
      expect(mockSafeguardingService.updateOfficer).toHaveBeenCalledWith('officer-1', dto);
    });
  });

  describe('deleteOfficer', () => {
    it('should delete an officer via the service', async () => {
      mockSafeguardingService.deleteOfficer.mockResolvedValue(undefined);

      await controller.deleteOfficer('officer-1');

      expect(mockSafeguardingService.deleteOfficer).toHaveBeenCalledWith('officer-1');
    });
  });

  describe('getIncidents', () => {
    it('should return the club incidents from the service', async () => {
      mockSafeguardingService.getIncidents.mockResolvedValue([mockIncident]);

      const result = await controller.getIncidents();

      expect(result).toEqual([mockIncident]);
      expect(mockSafeguardingService.getIncidents).toHaveBeenCalled();
    });
  });

  describe('createIncident', () => {
    it('should call safeguardingService.createIncident and return the result', async () => {
      const createDto = {
        date: '2026-03-15',
        category: 'Safeguarding concern',
        summary: 'A concern was raised',
        status: IncidentStatus.OPEN,
        reported_by: 'Alex Rivers',
      };

      mockSafeguardingService.createIncident.mockResolvedValue(mockIncident);

      const result = await controller.createIncident(createDto);

      expect(result).toEqual(mockIncident);
      expect(mockSafeguardingService.createIncident).toHaveBeenCalledWith(createDto);
    });
  });
});
