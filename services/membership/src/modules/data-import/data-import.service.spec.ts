import { Test, TestingModule } from '@nestjs/testing';
import { GoverningBody } from '@club-manager/shared-types';
import { DataImportService } from './data-import.service';
import { FamiliesRepository } from '../families/families.repository';
import { MembersRepository } from '../members/members.repository';
import { SquadsRepository } from '../squads/squads.repository';
import { ImportMembersDto } from './dto/import-members.dto';
import { MemberImportRowDto } from './dto/member-import-row.dto';

describe('DataImportService', () => {
  let service: DataImportService;

  const mockFamiliesRepository = {
    findByPrimaryContactEmail: jest.fn(),
    create: jest.fn(),
  };

  const mockMembersRepository = {
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const mockSquadsRepository = {
    findAllNames: jest.fn(),
    create: jest.fn(),
  };

  const baseRow: MemberImportRowDto = {
    member_first_name: 'Amelia',
    member_last_name: 'Jones',
    dob: '2012-04-01',
    gender: 'Female',
    parent_name: 'Sarah Jones',
    parent_email: 'sarah.jones@example.com',
  };

  const makeDto = (rows: MemberImportRowDto[], createMissingSquads = false): ImportMembersDto => ({
    rows,
    options: { create_missing_squads: createMissingSquads },
  });

  const existingFamily = {
    family_id: 'family-1',
    family_name: 'Jones',
    primary_contact_email: 'sarah.jones@example.com',
  };

  const existingMember = {
    member_id: 'member-1',
    first_name: 'Amelia',
    last_name: 'Jones',
    dob: new Date('2012-04-01'),
    gender: 'F',
    registration_number: '1234567',
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
        { provide: MembersRepository, useValue: mockMembersRepository },
        { provide: SquadsRepository, useValue: mockSquadsRepository },
      ],
    }).compile();

    service = module.get<DataImportService>(DataImportService);

    mockMembersRepository.findAll.mockResolvedValue([]);
    mockSquadsRepository.findAllNames.mockResolvedValue([]);
    mockFamiliesRepository.findByPrimaryContactEmail.mockResolvedValue(null);
    mockFamiliesRepository.create.mockResolvedValue({ family_id: 'new-family-1' });
    mockMembersRepository.create.mockResolvedValue({ member_id: 'new-member-1' });
    mockMembersRepository.update.mockResolvedValue({ member_id: 'member-1' });
    mockSquadsRepository.create.mockResolvedValue({
      squad_id: 'new-squad-1',
      squad_name: 'Juniors',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('reports invalid birth dates before creating families or members', async () => {
    const result = await service.importMembers(makeDto([{ ...baseRow, dob: '9999-12-31' }]));
    expect(result.errors).toEqual([
      { row: 1, message: 'Date of birth must be a valid date on or before today' },
    ]);
    expect(mockFamiliesRepository.create).not.toHaveBeenCalled();
    expect(mockMembersRepository.create).not.toHaveBeenCalled();
    expect(mockMembersRepository.update).not.toHaveBeenCalled();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('family grouping', () => {
    it('creates one family for two rows sharing the same parent email', async () => {
      const rows: MemberImportRowDto[] = [
        { ...baseRow, member_first_name: 'Amelia' },
        {
          ...baseRow,
          member_first_name: 'Oliver',
          gender: 'Male',
          parent_email: 'SARAH.JONES@example.com',
        },
      ];

      const result = await service.importMembers(makeDto(rows));

      expect(mockFamiliesRepository.create).toHaveBeenCalledTimes(1);
      expect(result.summary.families_created).toBe(1);
      expect(result.summary.members_created).toBe(2);
      expect(result.errors).toEqual([]);

      // Both members are linked to the one created family
      expect(mockMembersRepository.create).toHaveBeenCalledTimes(2);
      for (const call of mockMembersRepository.create.mock.calls) {
        expect(call[0].family_id).toBe('new-family-1');
      }
    });

    it('defaults the family name to the member last name when blank', async () => {
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
      expect(mockMembersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ family_id: 'family-1' }),
      );
    });
  });

  describe('member upsert', () => {
    it('updates an existing member matched by registration_number', async () => {
      mockMembersRepository.findAll.mockResolvedValue([existingMember]);

      const result = await service.importMembers(
        makeDto([{ ...baseRow, registration_number: '1234567', medical_notes: 'Asthma' }]),
      );

      expect(mockMembersRepository.update).toHaveBeenCalledWith(
        'member-1',
        expect.objectContaining({ medical_notes: 'Asthma', gender: 'F' }),
      );
      expect(mockMembersRepository.create).not.toHaveBeenCalled();
      expect(result.summary.members_updated).toBe(1);
      expect(result.summary.members_created).toBe(0);
    });

    it('updates an existing member matched by name and dob (case-insensitive)', async () => {
      mockMembersRepository.findAll.mockResolvedValue([existingMember]);

      const result = await service.importMembers(
        makeDto([
          {
            ...baseRow,
            member_first_name: 'AMELIA',
            member_last_name: 'jones',
            registration_number: undefined,
          },
        ]),
      );

      expect(mockMembersRepository.update).toHaveBeenCalledWith('member-1', expect.anything());
      expect(result.summary.members_updated).toBe(1);
    });

    it('matches on the (registration_number, governing_body) pair when both are provided', async () => {
      const englandMember = {
        ...existingMember,
        member_id: 'member-england',
        governing_body: GoverningBody.SWIM_ENGLAND,
      };
      const scotlandMember = {
        ...existingMember,
        member_id: 'member-scotland',
        first_name: 'Isla',
        governing_body: GoverningBody.SCOTTISH_SWIMMING,
      };
      mockMembersRepository.findAll.mockResolvedValue([englandMember, scotlandMember]);

      const result = await service.importMembers(
        makeDto([
          {
            ...baseRow,
            registration_number: '1234567',
            governing_body: GoverningBody.SCOTTISH_SWIMMING,
          },
        ]),
      );

      expect(mockMembersRepository.update).toHaveBeenCalledWith(
        'member-scotland',
        expect.anything(),
      );
      expect(result.summary.members_updated).toBe(1);
      expect(result.errors).toEqual([]);
    });

    it('records a row error when registration_number is ambiguous across governing bodies without governing_body', async () => {
      const englandMember = {
        ...existingMember,
        member_id: 'member-england',
        governing_body: GoverningBody.SWIM_ENGLAND,
      };
      const walesMember = {
        ...existingMember,
        member_id: 'member-wales',
        governing_body: GoverningBody.SWIM_WALES,
      };
      mockMembersRepository.findAll.mockResolvedValue([englandMember, walesMember]);

      const result = await service.importMembers(
        makeDto([{ ...baseRow, registration_number: '1234567' }]),
      );

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].row).toBe(1);
      expect(result.errors[0].message).toContain('governing_body');
      expect(mockMembersRepository.create).not.toHaveBeenCalled();
      expect(mockMembersRepository.update).not.toHaveBeenCalled();
    });

    it('collapses two payload rows with the same (registration_number, governing_body) into one member', async () => {
      const rows: MemberImportRowDto[] = [
        {
          ...baseRow,
          registration_number: '7654321',
          governing_body: GoverningBody.SWIM_ENGLAND,
        },
        {
          ...baseRow,
          registration_number: '7654321',
          governing_body: GoverningBody.SWIM_ENGLAND,
          medical_notes: 'Asthma',
        },
      ];

      const result = await service.importMembers(makeDto(rows));

      expect(mockMembersRepository.create).toHaveBeenCalledTimes(1);
      expect(mockMembersRepository.update).toHaveBeenCalledTimes(1);
      expect(mockMembersRepository.update).toHaveBeenCalledWith(
        'new-member-1',
        expect.objectContaining({ medical_notes: 'Asthma' }),
      );
      expect(result.summary.members_created).toBe(1);
      expect(result.summary.members_updated).toBe(1);
      expect(result.errors).toEqual([]);
    });

    it('creates a member with normalised gender when there is no match', async () => {
      const result = await service.importMembers(makeDto([baseRow]));

      expect(mockMembersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          first_name: 'Amelia',
          last_name: 'Jones',
          gender: 'F',
        }),
      );
      expect(result.summary.members_created).toBe(1);
    });
  });

  describe('squad resolution', () => {
    it('matches an existing squad case-insensitively', async () => {
      mockSquadsRepository.findAllNames.mockResolvedValue([existingSquad]);

      const result = await service.importMembers(
        makeDto([{ ...baseRow, squad_name: 'development squad' }]),
      );

      expect(mockSquadsRepository.create).not.toHaveBeenCalled();
      expect(mockMembersRepository.create).toHaveBeenCalledWith(
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
      expect(mockMembersRepository.create).not.toHaveBeenCalled();
      expect(mockFamiliesRepository.create).not.toHaveBeenCalled();
    });

    it('creates an unknown squad once when create_missing_squads is true', async () => {
      const rows: MemberImportRowDto[] = [
        { ...baseRow, squad_name: 'Juniors' },
        { ...baseRow, member_first_name: 'Oliver', squad_name: 'juniors' },
      ];

      const result = await service.importMembers(makeDto(rows, true));

      expect(mockSquadsRepository.create).toHaveBeenCalledTimes(1);
      expect(mockSquadsRepository.create).toHaveBeenCalledWith({ squad_name: 'Juniors' });
      expect(result.errors).toEqual([]);
      for (const call of mockMembersRepository.create.mock.calls) {
        expect(call[0].squad_id).toBe('new-squad-1');
      }
    });
  });

  describe('previewMembers', () => {
    it('persists nothing and reports planned actions', async () => {
      mockMembersRepository.findAll.mockResolvedValue([existingMember]);
      mockSquadsRepository.findAllNames.mockResolvedValue([existingSquad]);

      const rows: MemberImportRowDto[] = [
        { ...baseRow, registration_number: '1234567', squad_name: 'Development Squad' },
        {
          ...baseRow,
          member_first_name: 'Oliver',
          parent_email: 'new.parent@example.com',
          squad_name: 'Unknown Squad',
        },
      ];

      const result = await service.previewMembers(makeDto(rows, false));

      expect(mockFamiliesRepository.create).not.toHaveBeenCalled();
      expect(mockMembersRepository.create).not.toHaveBeenCalled();
      expect(mockMembersRepository.update).not.toHaveBeenCalled();
      expect(mockSquadsRepository.create).not.toHaveBeenCalled();

      expect(result.summary).toEqual({
        // Row 1's family is new and importable; row 2's family is not created
        // because its only row has a squad error.
        families_to_create: 1,
        families_matched: 0,
        members_to_create: 0,
        members_to_update: 1,
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
      mockMembersRepository.create
        .mockRejectedValueOnce(new Error('duplicate registration number'))
        .mockResolvedValueOnce({ member_id: 'new-member-2' });

      const rows: MemberImportRowDto[] = [
        baseRow,
        {
          ...baseRow,
          member_first_name: 'Oliver',
          parent_email: 'other.parent@example.com',
        },
      ];

      const result = await service.importMembers(makeDto(rows));

      expect(result.summary.members_created).toBe(1);
      expect(result.errors).toEqual([{ row: 1, message: 'duplicate registration number' }]);
      expect(mockMembersRepository.create).toHaveBeenCalledTimes(2);
    });

    it('marks all rows of a family as errored when family creation fails, and continues', async () => {
      mockFamiliesRepository.create
        .mockRejectedValueOnce(new Error('family insert failed'))
        .mockResolvedValueOnce({ family_id: 'new-family-2' });

      const rows: MemberImportRowDto[] = [
        baseRow,
        {
          ...baseRow,
          member_first_name: 'Oliver',
          parent_email: 'other.parent@example.com',
        },
      ];

      const result = await service.importMembers(makeDto(rows));

      expect(result.summary.families_created).toBe(1);
      expect(result.summary.members_created).toBe(1);
      expect(result.errors).toEqual([{ row: 1, message: 'family insert failed' }]);
    });
  });
});
