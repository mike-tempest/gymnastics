import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { isValidDateOfBirth } from './date-of-birth.validator';
import { CreateMemberDto } from '../../modules/members/dto/create-member.dto';
import { UpdateMemberDto } from '../../modules/members/dto/update-member.dto';
import { ImportMembersDto } from '../../modules/data-import/dto/import-members.dto';
import { MemberImportRowDto } from '../../modules/data-import/dto/member-import-row.dto';
import {
  JoinWaitingListDto,
  CreateWaitingListEntryDto,
  UpdateWaitingListEntryDto,
} from '../../modules/waiting-list/dto/waiting-list-entry.dto';

const today = '2026-09-09';

describe('Date of birth validation', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date(`${today}T12:00:00Z`)));
  afterEach(() => jest.useRealTimers());

  it.each(['2010-05-15', '2024-02-29', today])('accepts %s', (date) => {
    expect(isValidDateOfBirth(date)).toBe(true);
  });

  it.each([
    '2026-09-10',
    '2027-01-01',
    '2025-02-29',
    '2026-02-30',
    '',
    'not-a-date',
    '2020-01-01T00:00:00Z',
    null,
    undefined,
  ])('rejects %s', (date) => {
    expect(isValidDateOfBirth(date)).toBe(false);
  });

  it('recalculates today across midnight without a server restart', () => {
    jest.setSystemTime(new Date('2026-09-09T23:59:59Z'));
    expect(isValidDateOfBirth('2026-09-10')).toBe(false);
    jest.setSystemTime(new Date('2026-09-10T00:00:00Z'));
    expect(isValidDateOfBirth('2026-09-10')).toBe(true);
  });

  it.each([CreateMemberDto, UpdateMemberDto, MemberImportRowDto])(
    'rejects a future dob through %p',
    async (Dto) => {
      const errors = await validate(Object.assign(new Dto(), { dob: '2026-09-10' }));
      expect(errors.find((error) => error.property === 'dob')?.constraints).toHaveProperty(
        'isDateOfBirth',
      );
    },
  );

  it.each([JoinWaitingListDto, CreateWaitingListEntryDto, UpdateWaitingListEntryDto])(
    'rejects a future child_dob through %p',
    async (Dto) => {
      const errors = await validate(Object.assign(new Dto(), { child_dob: '2026-09-10' }));
      expect(errors.find((error) => error.property === 'child_dob')?.constraints).toHaveProperty(
        'isDateOfBirth',
      );
    },
  );

  it('validates nested import rows', async () => {
    const dto = plainToInstance(ImportMembersDto, {
      rows: [
        {
          member_first_name: 'Test',
          member_last_name: 'Child',
          dob: '2026-09-10',
          gender: 'M',
          parent_name: 'Parent',
          parent_email: 'parent@example.com',
        },
      ],
      options: { create_missing_squads: false },
    });
    expect(JSON.stringify(await validate(dto))).toContain('isDateOfBirth');
  });

  it('allows updates that omit the birth date', async () => {
    expect(await validate(new UpdateMemberDto())).toEqual([]);
    expect(await validate(new UpdateWaitingListEntryDto())).toEqual([]);
  });
});
