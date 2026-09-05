import { Test, TestingModule } from '@nestjs/testing';
import { GoverningBody } from '@club-manager/shared-types';
import { DataImportService } from './data-import.service';
import { FamiliesRepository } from '../families/families.repository';
import { SwimmersRepository } from '../swimmers/swimmers.repository';
import { SquadsRepository } from '../squads/squads.repository';
import { ImportMembersDto } from './dto/import-members.dto';
import { MemberImportRowDto } from './dto/member-import-row.dto';

describe('DataImportService', () => {
  let service: DataImportService;

  const mockFamiliesRepository = {
    findByPrimaryContactEmail: jest.fn(),
    create: jest.fn(),
  };

  const mockSwimmersRepository = {
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const mockSquadsRepository = {
    findAllNames: jest.fn(),
    create: jest.fn(),
  };

  const baseRow: MemberImportRowDto = {
    swimmer_first_name: 'Amelia',
    swimmer_last_name: 'Jones',
    dob: '2012-04-01',
    gender: 'Female',
    parent_name: 'Sarah Jones',
    parent_email: 'sarah.jones@example.com',
  };

  const makeDto = (
    rows: MemberImportRowDto[],
    createMissingSquads = false,
  ): ImportMembersDto => ({
    rows,
    options: { create_missing_squads: createMissingSquads },
  });

  const existingFamily = {
    family_id: 'family-1',
    family_name: 'Jones',
    primary_contact_email: 'sarah.jones@example.com',
  };

  const existingSwimmer = {
    swimmer_id: 'swimmer-1',
    first_name: 'Amelia',
    last_name: 'Jones',
    dob: new Date('2012-04-01'),
    gender: 'F',
    se_number: '1234567',
  };

  const existingSquad = {
    squad_id: 'squad-1',
    squad_name: 'Development Squad',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataImportService,
        { provide: FamiliesRepository, useValue: mockFamiliesRepository },
        { provide: SwimmersRepository, useValue: mockSwimmersRepository },
        { provide: SquadsRepository, useValue: mockSquadsRepository },
      ],
    }).compile();

    service = module.get<DataImportService>(DataImportService);

    mockSwimmersRepository.findAll.mockResolvedValue([]);
    mockSquadsRepository.findAllNames.mockResolvedValue([]);
    mockFamiliesRepository.findByPrimaryContactEmail.mockResolvedValue(null);
    mockFamiliesRepository.create.mockResolvedValue({ family_id: 'new-family-1' });
    mockSwimmersRepository.create.mockResolvedValue({ swimmer_id: 'new-swimmer-1' });
    mockSwimmersRepository.update.mockResolvedValue({ swimmer_id: 'swimmer-1' });
    mockSquadsRepository.create.mockResolvedValue({
      squad_id: 'new-squad-1',
      squad_name: 'Juniors',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('family grouping', () => {
    it('creates one family for two rows sharing the same parent email', async () => {
      const rows: MemberImportRowDto[] = [
        { ...baseRow, swimmer_first_name: 'Amelia' },
        {
          ...baseRow,
          swimmer_first_name: 'Oliver',
          gender: 'Male',
          parent_email: 'SARAH.JONES@example.com',
        },
      ];

      const result = await service.importMembers(makeDto(rows));

      expect(mockFamiliesRepository.create).toHaveBeenCalledTimes(1);
      expect(result.summary.families_created).toBe(1);
      expect(result.summary.swimmers_created).toBe(2);
      expect(result.errors).toEqual([]);

      // Both swimmers are linked to the one created family
      expect(mockSwimmersRepository.create).toHaveBeenCalledTimes(2);
      for (const call of mockSwimmersRepository.create.mock.calls) {
        expect(call[0].family_id).toBe('new-family-1');
      }
    });

    it('defaults the family name to the swimmer last name when blank', async () => {
      await service.importMembers(makeDto([{ ...baseRow, family_name: undefined }]));

      expect(mockFamiliesRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          family_name: 'Jones',
          primary_contact_name: 'Sarah Jones',
          primary_contact_email: 'sarah.jones@example.com',
        }),
      );
    });

    it('matches an existing family by email instead of creating one', async () => {
      mockFamiliesRepository.findByPrimaryContactEmail.mockResolvedValue(existingFamily);

      const result = await service.importMembers(makeDto([baseRow]));

      expect(mockFamiliesRepository.create).not.toHaveBeenCalled();
      expect(result.summary.families_created).toBe(0);
      expect(mockSwimmersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ family_id: 'family-1' }),
      );
    });
  });

  describe('swimmer upsert', () => {
    it('updates an existing swimmer matched by se_number', async () => {
      mockSwimmersRepository.findAll.mockResolvedValue([existingSwimmer]);

      const result = await service.importMembers(
        makeDto([{ ...baseRow, se_number: '1234567', medical_notes: 'Asthma' }]),
      );

      expect(mockSwimmersRepository.update).toHaveBeenCalledWith(
        'swimmer-1',
        expect.objectContaining({ medical_notes: 'Asthma', gender: 'F' }),
      );
      expect(mockSwimmersRepository.create).not.toHaveBeenCalled();
      expect(result.summary.swimmers_updated).toBe(1);
      expect(result.summary.swimmers_created).toBe(0);
    });

    it('updates an existing swimmer matched by name and dob (case-insensitive)', async () => {
      mockSwimmersRepository.findAll.mockResolvedValue([existingSwimmer]);

      const result = await service.importMembers(
        makeDto([
          {
            ...baseRow,
            swimmer_first_name: 'AMELIA',
            swimmer_last_name: 'jones',
            se_number: undefined,
          },
        ]),
      );

      expect(mockSwimmersRepository.update).toHaveBeenCalledWith('swimmer-1', expect.anything());
      expect(result.summary.swimmers_updated).toBe(1);
    });

    it('matches on the (se_number, governing_body) pair when both are provided', async () => {
      const englandSwimmer = {
        ...existingSwimmer,
        swimmer_id: 'swimmer-england',
        governing_body: GoverningBody.SWIM_ENGLAND,
      };
      const scotlandSwimmer = {
        ...existingSwimmer,
        swimmer_id: 'swimmer-scotland',
        first_name: 'Isla',
        governing_body: GoverningBody.SCOTTISH_SWIMMING,
      };
      mockSwimmersRepository.findAll.mockResolvedValue([englandSwimmer, scotlandSwimmer]);

      const result = await service.importMembers(
        makeDto([
          {
            ...baseRow,
            se_number: '1234567',
            governing_body: GoverningBody.SCOTTISH_SWIMMING,
          },
        ]),
      );

      expect(mockSwimmersRepository.update).toHaveBeenCalledWith(
        'swimmer-scotland',
        expect.anything(),
      );
      expect(result.summary.swimmers_updated).toBe(1);
      expect(result.errors).toEqual([]);
    });

    it('records a row error when se_number is ambiguous across governing bodies without governing_body', async () => {
      const englandSwimmer = {
        ...existingSwimmer,
        swimmer_id: 'swimmer-england',
        governing_body: GoverningBody.SWIM_ENGLAND,
      };
      const walesSwimmer = {
        ...existingSwimmer,
        swimmer_id: 'swimmer-wales',
        governing_body: GoverningBody.SWIM_WALES,
      };
      mockSwimmersRepository.findAll.mockResolvedValue([englandSwimmer, walesSwimmer]);

      const result = await service.importMembers(makeDto([{ ...baseRow, se_number: '1234567' }]));

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].row).toBe(1);
      expect(result.errors[0].message).toContain('governing_body');
      expect(mockSwimmersRepository.create).not.toHaveBeenCalled();
      expect(mockSwimmersRepository.update).not.toHaveBeenCalled();
    });

    it('collapses two payload rows with the same (se_number, governing_body) into one swimmer', async () => {
      const rows: MemberImportRowDto[] = [
        {
          ...baseRow,
          se_number: '7654321',
          governing_body: GoverningBody.SWIM_ENGLAND,
        },
        {
          ...baseRow,
          se_number: '7654321',
          governing_body: GoverningBody.SWIM_ENGLAND,
          medical_notes: 'Asthma',
        },
      ];

      const result = await service.importMembers(makeDto(rows));

      expect(mockSwimmersRepository.create).toHaveBeenCalledTimes(1);
      expect(mockSwimmersRepository.update).toHaveBeenCalledTimes(1);
      expect(mockSwimmersRepository.update).toHaveBeenCalledWith(
        'new-swimmer-1',
        expect.objectContaining({ medical_notes: 'Asthma' }),
      );
      expect(result.summary.swimmers_created).toBe(1);
      expect(result.summary.swimmers_updated).toBe(1);
      expect(result.errors).toEqual([]);
    });

    it('creates a swimmer with normalised gender when there is no match', async () => {
      const result = await service.importMembers(makeDto([baseRow]));

      expect(mockSwimmersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          first_name: 'Amelia',
          last_name: 'Jones',
          gender: 'F',
        }),
      );
      expect(result.summary.swimmers_created).toBe(1);
    });
  });

  describe('squad resolution', () => {
    it('matches an existing squad case-insensitively', async () => {
      mockSquadsRepository.findAllNames.mockResolvedValue([existingSquad]);

      const result = await service.importMembers(
        makeDto([{ ...baseRow, squad_name: 'development squad' }]),
      );

      expect(mockSquadsRepository.create).not.toHaveBeenCalled();
      expect(mockSwimmersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ squad_id: 'squad-1' }),
      );
      expect(result.errors).toEqual([]);
    });

    it('records a row error for an unknown squad when create_missing_squads is false', async () => {
      const result = await service.importMembers(
        makeDto([{ ...baseRow, squad_name: 'Juniors' }], false),
      );

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].row).toBe(1);
      expect(result.errors[0].message).toContain('Juniors');
      expect(mockSwimmersRepository.create).not.toHaveBeenCalled();
      expect(mockFamiliesRepository.create).not.toHaveBeenCalled();
    });

    it('creates an unknown squad once when create_missing_squads is true', async () => {
      const rows: MemberImportRowDto[] = [
        { ...baseRow, squad_name: 'Juniors' },
        { ...baseRow, swimmer_first_name: 'Oliver', squad_name: 'juniors' },
      ];

      const result = await service.importMembers(makeDto(rows, true));

      expect(mockSquadsRepository.create).toHaveBeenCalledTimes(1);
      expect(mockSquadsRepository.create).toHaveBeenCalledWith({ squad_name: 'Juniors' });
      expect(result.errors).toEqual([]);
      for (const call of mockSwimmersRepository.create.mock.calls) {
        expect(call[0].squad_id).toBe('new-squad-1');
      }
    });
  });

  describe('previewMembers', () => {
    it('persists nothing and reports planned actions', async () => {
      mockSwimmersRepository.findAll.mockResolvedValue([existingSwimmer]);
      mockSquadsRepository.findAllNames.mockResolvedValue([existingSquad]);

      const rows: MemberImportRowDto[] = [
        { ...baseRow, se_number: '1234567', squad_name: 'Development Squad' },
        {
          ...baseRow,
          swimmer_first_name: 'Oliver',
          parent_email: 'new.parent@example.com',
          squad_name: 'Unknown Squad',
        },
      ];

      const result = await service.previewMembers(makeDto(rows, false));

      expect(mockFamiliesRepository.create).not.toHaveBeenCalled();
      expect(mockSwimmersRepository.create).not.toHaveBeenCalled();
      expect(mockSwimmersRepository.update).not.toHaveBeenCalled();
      expect(mockSquadsRepository.create).not.toHaveBeenCalled();

      expect(result.summary).toEqual({
        // Row 1's family is new and importable; row 2's family is not created
        // because its only row has a squad error.
        families_to_create: 1,
        families_matched: 0,
        swimmers_to_create: 0,
        swimmers_to_update: 1,
        squads_matched: ['Development Squad'],
        squads_missing: ['Unknown Squad'],
      });

      expect(result.row_results).toEqual([
        { row: 1, action: 'update', family_action: 'create', errors: [] },
        {
          row: 2,
          action: 'error',
          family_action: 'create',
          errors: [expect.stringContaining('Unknown Squad')],
        },
      ]);
    });

    it('reports a matched family as family_action match', async () => {
      mockFamiliesRepository.findByPrimaryContactEmail.mockResolvedValue(existingFamily);

      const result = await service.previewMembers(makeDto([baseRow]));

      expect(result.summary.families_matched).toBe(1);
      expect(result.summary.families_to_create).toBe(0);
      expect(result.row_results[0].family_action).toBe('match');
      expect(result.row_results[0].action).toBe('create');
    });
  });

  describe('per-row error handling', () => {
    it('continues the batch when one row fails to persist', async () => {
      mockSwimmersRepository.create
        .mockRejectedValueOnce(new Error('duplicate registration number'))
        .mockResolvedValueOnce({ swimmer_id: 'new-swimmer-2' });

      const rows: MemberImportRowDto[] = [
        baseRow,
        {
          ...baseRow,
          swimmer_first_name: 'Oliver',
          parent_email: 'other.parent@example.com',
        },
      ];

      const result = await service.importMembers(makeDto(rows));

      expect(result.summary.swimmers_created).toBe(1);
      expect(result.errors).toEqual([{ row: 1, message: 'duplicate registration number' }]);
      expect(mockSwimmersRepository.create).toHaveBeenCalledTimes(2);
    });

    it('marks all rows of a family as errored when family creation fails, and continues', async () => {
      mockFamiliesRepository.create
        .mockRejectedValueOnce(new Error('family insert failed'))
        .mockResolvedValueOnce({ family_id: 'new-family-2' });

      const rows: MemberImportRowDto[] = [
        baseRow,
        {
          ...baseRow,
          swimmer_first_name: 'Oliver',
          parent_email: 'other.parent@example.com',
        },
      ];

      const result = await service.importMembers(makeDto(rows));

      expect(result.summary.families_created).toBe(1);
      expect(result.summary.swimmers_created).toBe(1);
      expect(result.errors).toEqual([{ row: 1, message: 'family insert failed' }]);
    });
  });
});
