import {
  type AutoMapField,
  autoMapHeaders,
  matchHeader,
  normaliseGender,
  normaliseHeader,
} from '../header-mapping';

describe('normaliseHeader', () => {
  it('ignores case, spaces, underscores and hyphens', () => {
    expect(normaliseHeader('Member Number')).toBe('membernumber');
    expect(normaliseHeader('member_number')).toBe('membernumber');
    expect(normaliseHeader('member-number')).toBe('membernumber');
    expect(normaliseHeader('MemberNumber')).toBe('membernumber');
    expect(normaliseHeader('  MEMBER  NUMBER  ')).toBe('membernumber');
  });

  it('strips a leading BOM', () => {
    expect(normaliseHeader('﻿First Name')).toBe('firstname');
  });

  it('keeps digits', () => {
    expect(normaliseHeader('Address Line 1')).toBe('addressline1');
  });
});

describe('matchHeader', () => {
  it('maps Swim Central style member number headers to registration_number', () => {
    expect(matchHeader('Member Number')).toBe('registration_number');
    expect(matchHeader('Membership Number')).toBe('registration_number');
    expect(matchHeader('Member ID')).toBe('registration_number');
    expect(matchHeader('Registration Number')).toBe('registration_number');
  });

  it('maps name headers', () => {
    expect(matchHeader('Given Name')).toBe('first_name');
    expect(matchHeader('Preferred Name')).toBe('first_name');
    expect(matchHeader('First Name')).toBe('first_name');
    expect(matchHeader('Family Name')).toBe('last_name');
    expect(matchHeader('Surname')).toBe('last_name');
    expect(matchHeader('Last Name')).toBe('last_name');
  });

  it('maps date of birth, gender and contact headers', () => {
    expect(matchHeader('Date of Birth')).toBe('date_of_birth');
    expect(matchHeader('DOB')).toBe('date_of_birth');
    expect(matchHeader('Birth Date')).toBe('date_of_birth');
    expect(matchHeader('Sex')).toBe('gender');
    expect(matchHeader('Gender')).toBe('gender');
    expect(matchHeader('Contact Email')).toBe('parent_email');
    expect(matchHeader('Parent Email')).toBe('parent_email');
    expect(matchHeader('Email')).toBe('parent_email');
    expect(matchHeader('Mobile')).toBe('parent_phone');
    expect(matchHeader('Contact Number')).toBe('parent_phone');
    expect(matchHeader('Phone')).toBe('parent_phone');
  });

  it('returns null for unknown headers instead of failing', () => {
    expect(matchHeader('Member Since')).toBeNull();
    expect(matchHeader('Some Random Column')).toBeNull();
    expect(matchHeader('')).toBeNull();
  });
});

describe('autoMapHeaders', () => {
  type Field = 'first_name' | 'last_name' | 'dob' | 'se_number' | 'family';

  const fields: readonly AutoMapField<Field>[] = [
    { key: 'first_name', canonical: 'first_name' },
    { key: 'last_name', canonical: 'last_name' },
    { key: 'dob', canonical: 'date_of_birth' },
    { key: 'se_number', canonical: 'registration_number' },
    { key: 'family', canonical: 'family' },
  ];

  it('maps a Swim Central style header row via synonyms', () => {
    const mapping = autoMapHeaders(
      ['Member Number', 'Given Name', 'Family Name', 'Date of Birth', 'Club'],
      fields,
    );
    expect(mapping).toEqual({
      se_number: 'Member Number',
      first_name: 'Given Name',
      last_name: 'Family Name',
      dob: 'Date of Birth',
    });
  });

  it('prefers exact field key matches over synonyms', () => {
    // A re-uploaded Swimly template maps to itself even where a header is
    // also a synonym for another concept.
    const mapping = autoMapHeaders(
      ['first_name', 'Surname', 'dob', 'se_number', 'family'],
      fields,
    );
    expect(mapping.family).toBe('family');
    expect(mapping.last_name).toBe('Surname');
  });

  it('claims each header at most once', () => {
    const mapping = autoMapHeaders(['First Name', 'Given Name', 'Surname'], fields);
    expect(mapping.first_name).toBe('First Name');
    // 'Given Name' stays unclaimed because first_name is already mapped.
    expect(Object.values(mapping)).not.toContain('Given Name');
  });

  it('leaves unknown headers unmapped without error', () => {
    const mapping = autoMapHeaders(['Wibble', 'Wobble'], fields);
    expect(mapping).toEqual({});
  });
});

describe('normaliseGender', () => {
  it('accepts codes and words in any case', () => {
    expect(normaliseGender('M')).toBe('M');
    expect(normaliseGender('male')).toBe('M');
    expect(normaliseGender('Female')).toBe('F');
    expect(normaliseGender('f')).toBe('F');
    expect(normaliseGender('Other')).toBe('X');
  });

  it('respects the allowed list', () => {
    expect(normaliseGender('Other', ['M', 'F'])).toBeNull();
    expect(normaliseGender('Male', ['M', 'F'])).toBe('M');
  });

  it('returns null for unrecognised values', () => {
    expect(normaliseGender('unknown')).toBeNull();
    expect(normaliseGender('')).toBeNull();
  });
});
