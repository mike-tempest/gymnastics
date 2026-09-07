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
    expect(matchHeader('Registration Number')).toBe('registration_number');
  });

  it('leaves Member ID unmapped so re-imported platform exports keep their UUIDs out of registration_number', () => {
    expect(matchHeader('Member ID')).toBeNull();
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

/**
 * Vendor vocabularies for the incumbents catalogued in
 * docs/04-Incumbent-Landscape-Pricing-and-Exports.md. Header names follow
 * that document's description of each export.
 */
describe('matchHeader for incumbent exports', () => {
  describe('GoCardless dashboard exports', () => {
    it('maps the customers export columns', () => {
      expect(matchHeader('email')).toBe('parent_email');
      expect(matchHeader('given_name')).toBe('first_name');
      expect(matchHeader('family_name')).toBe('last_name');
      expect(matchHeader('address_line1')).toBe('address_line1');
      expect(matchHeader('postal_code')).toBe('postcode');
      expect(matchHeader('phone_number')).toBe('parent_phone');
      expect(matchHeader('created_at')).toBe('created_at');
    });

    it('maps the mandates export columns', () => {
      expect(matchHeader('customer')).toBe('provider_customer_id');
      expect(matchHeader('Customer ID')).toBe('provider_customer_id');
      expect(matchHeader('scheme')).toBe('mandate_scheme');
      expect(matchHeader('reference')).toBe('mandate_reference');
      expect(matchHeader('Mandate Status')).toBe('mandate_status');
    });

    it('maps the payments export columns', () => {
      expect(matchHeader('mandate')).toBe('provider_mandate_id');
      expect(matchHeader('charge_date')).toBe('charge_date');
      expect(matchHeader('amount')).toBe('amount');
      expect(matchHeader('currency')).toBe('currency');
      expect(matchHeader('description')).toBe('description');
    });

    it('leaves the bare id column unmapped, because it means a different thing per file', () => {
      // customers.csv, mandates.csv and payments.csv all have an "id"
      // column; the takeover wizard resolves it from the detected file role.
      expect(matchHeader('id')).toBeNull();
    });
  });

  describe('ClassForKids spreadsheets', () => {
    it('maps the child name column that the register and financial sheets share', () => {
      expect(matchHeader('Child Name')).toBe('member_full_name');
      expect(matchHeader("Child's Name")).toBe('member_full_name');
      expect(matchHeader('Participant Name')).toBe('member_full_name');
    });

    it('maps a class column onto the squad concept', () => {
      expect(matchHeader('Class')).toBe('squad');
      expect(matchHeader('Class Name')).toBe('squad');
      expect(matchHeader('Session')).toBe('squad');
    });

    it('maps the venue and day context columns', () => {
      expect(matchHeader('Venue')).toBe('venue');
      expect(matchHeader('Location')).toBe('venue');
      expect(matchHeader('Day')).toBe('day');
      expect(matchHeader('Day of Week')).toBe('day');
    });

    it('maps the financial money columns onto one informational amount concept', () => {
      expect(matchHeader('Amount')).toBe('amount');
      expect(matchHeader('Amount Paid')).toBe('amount');
      expect(matchHeader('Outstanding')).toBe('amount');
      expect(matchHeader('Income')).toBe('amount');
    });

    it('maps the parent column on a financial summary', () => {
      expect(matchHeader('Parent')).toBe('parent_name');
      expect(matchHeader('Parent Email')).toBe('parent_email');
    });
  });

  describe('Thrive4 / LoveAdmin contact exports', () => {
    it('maps the participant name columns', () => {
      expect(matchHeader('Contact First Name')).toBe('first_name');
      expect(matchHeader('Contact Last Name')).toBe('last_name');
    });

    it('maps the account holder as the parent, not the gymnast', () => {
      expect(matchHeader('Account Holder')).toBe('parent_name');
      expect(matchHeader('Account Holder Email')).toBe('parent_email');
      expect(matchHeader('Payer Name')).toBe('parent_name');
      expect(matchHeader('Home Phone')).toBe('parent_phone');
    });

    it('maps its group columns onto the squad concept', () => {
      expect(matchHeader('Groups')).toBe('squad');
      expect(matchHeader('Group Name')).toBe('squad');
      expect(matchHeader('Member Group')).toBe('squad');
    });

    it('still maps the membership number it shares with My BG', () => {
      expect(matchHeader('Membership Number')).toBe('registration_number');
    });
  });

  it('keeps the deliberate Member ID exclusion', () => {
    expect(matchHeader('Member ID')).toBeNull();
    expect(matchHeader('member_id')).toBeNull();
  });
});

describe('autoMapHeaders', () => {
  type Field = 'first_name' | 'last_name' | 'dob' | 'registration_number' | 'family';

  const fields: readonly AutoMapField<Field>[] = [
    { key: 'first_name', canonical: 'first_name' },
    { key: 'last_name', canonical: 'last_name' },
    { key: 'dob', canonical: 'date_of_birth' },
    { key: 'registration_number', canonical: 'registration_number' },
    { key: 'family', canonical: 'family' },
  ];

  it('maps a Swim Central style header row via synonyms', () => {
    const mapping = autoMapHeaders(
      ['Member Number', 'Given Name', 'Family Name', 'Date of Birth', 'Club'],
      fields,
    );
    expect(mapping).toEqual({
      registration_number: 'Member Number',
      first_name: 'Given Name',
      last_name: 'Family Name',
      dob: 'Date of Birth',
    });
  });

  it('prefers exact field key matches over synonyms', () => {
    // A re-uploaded Swimly template maps to itself even where a header is
    // also a synonym for another concept.
    const mapping = autoMapHeaders(
      ['first_name', 'Surname', 'dob', 'registration_number', 'family'],
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

  it('auto-maps a Thrive4 contact export onto the members wizard fields', () => {
    type MemberField =
      | 'member_first_name'
      | 'member_last_name'
      | 'date_of_birth'
      | 'gender'
      | 'squad_name'
      | 'parent_name'
      | 'parent_email'
      | 'parent_phone'
      | 'postcode';

    const memberFields: readonly AutoMapField<MemberField>[] = [
      { key: 'member_first_name', canonical: 'first_name' },
      { key: 'member_last_name', canonical: 'last_name' },
      { key: 'date_of_birth', canonical: 'date_of_birth' },
      { key: 'gender', canonical: 'gender' },
      { key: 'squad_name', canonical: 'squad' },
      { key: 'parent_name', canonical: 'parent_name' },
      { key: 'parent_email', canonical: 'parent_email' },
      { key: 'parent_phone', canonical: 'parent_phone' },
      { key: 'postcode', canonical: 'postcode' },
    ];

    const mapping = autoMapHeaders(
      [
        'Contact First Name',
        'Contact Last Name',
        'Date of Birth',
        'Gender',
        'Groups',
        'Account Holder',
        'Account Holder Email',
        'Home Phone',
        'Postcode',
        'Balance',
      ],
      memberFields,
    );

    expect(mapping).toEqual({
      member_first_name: 'Contact First Name',
      member_last_name: 'Contact Last Name',
      date_of_birth: 'Date of Birth',
      gender: 'Gender',
      squad_name: 'Groups',
      parent_name: 'Account Holder',
      parent_email: 'Account Holder Email',
      parent_phone: 'Home Phone',
      postcode: 'Postcode',
    });
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
