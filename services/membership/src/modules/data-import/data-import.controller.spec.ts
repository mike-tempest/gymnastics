import { Test, TestingModule } from '@nestjs/testing';
import { DataImportController } from './data-import.controller';
import { DataImportService } from './data-import.service';
import { GoCardlessTakeoverService } from './gocardless-takeover.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ImportMembersDto } from './dto/import-members.dto';
import { ImportGoCardlessDto } from './dto/import-gocardless.dto';

describe('DataImportController', () => {
  let controller: DataImportController;

  const mockDataImportService = {
    previewMembers: jest.fn(),
    importMembers: jest.fn(),
  };

  const mockGoCardlessTakeoverService = {
    previewGoCardless: jest.fn(),
    importGoCardless: jest.fn(),
  };

  const goCardlessDto: ImportGoCardlessDto = {
    customers: [{ id: 'CU0001', email: 'sarah.hartley@example.co.uk' }],
    mandates: [{ id: 'MD0001', customer: 'CU0001', status: 'active' }],
    options: { create_missing_families: true },
  };

  const dto: ImportMembersDto = {
    rows: [
      {
        member_first_name: 'Amelia',
        member_last_name: 'Jones',
        dob: '2012-04-01',
        gender: 'F',
        parent_name: 'Sarah Jones',
        parent_email: 'sarah.jones@example.com',
      },
    ],
    options: { create_missing_squads: false },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DataImportController],
      providers: [
        {
          provide: DataImportService,
          useValue: mockDataImportService,
        },
        {
          provide: GoCardlessTakeoverService,
          useValue: mockGoCardlessTakeoverService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DataImportController>(DataImportController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('runs a dry run when preview=true', async () => {
    const previewResponse = { summary: {}, row_results: [] };
    mockDataImportService.previewMembers.mockResolvedValue(previewResponse);

    const result = await controller.importMembers(dto, 'true');

    expect(mockDataImportService.previewMembers).toHaveBeenCalledWith(dto);
    expect(mockDataImportService.importMembers).not.toHaveBeenCalled();
    expect(result).toBe(previewResponse);
  });

  it('performs the import when preview is absent', async () => {
    const importResponse = { summary: {}, errors: [] };
    mockDataImportService.importMembers.mockResolvedValue(importResponse);

    const result = await controller.importMembers(dto, undefined);

    expect(mockDataImportService.importMembers).toHaveBeenCalledWith(dto);
    expect(mockDataImportService.previewMembers).not.toHaveBeenCalled();
    expect(result).toBe(importResponse);
  });

  it('performs the import when preview=false', async () => {
    const importResponse = { summary: {}, errors: [] };
    mockDataImportService.importMembers.mockResolvedValue(importResponse);

    await controller.importMembers(dto, 'false');

    expect(mockDataImportService.importMembers).toHaveBeenCalledWith(dto);
    expect(mockDataImportService.previewMembers).not.toHaveBeenCalled();
  });

  it('dry runs the GoCardless takeover when preview=true', async () => {
    const previewResponse = { summary: {}, customer_results: [], mandate_results: [] };
    mockGoCardlessTakeoverService.previewGoCardless.mockResolvedValue(previewResponse);

    const result = await controller.importGoCardless(goCardlessDto, 'true');

    expect(mockGoCardlessTakeoverService.previewGoCardless).toHaveBeenCalledWith(goCardlessDto);
    expect(mockGoCardlessTakeoverService.importGoCardless).not.toHaveBeenCalled();
    expect(result).toBe(previewResponse);
  });

  it('performs the GoCardless takeover when preview is absent', async () => {
    const importResponse = { summary: {}, errors: [], warnings: [] };
    mockGoCardlessTakeoverService.importGoCardless.mockResolvedValue(importResponse);

    const result = await controller.importGoCardless(goCardlessDto, undefined);

    expect(mockGoCardlessTakeoverService.importGoCardless).toHaveBeenCalledWith(goCardlessDto);
    expect(mockGoCardlessTakeoverService.previewGoCardless).not.toHaveBeenCalled();
    expect(result).toBe(importResponse);
  });
});
