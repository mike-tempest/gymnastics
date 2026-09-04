import { isValidPhone, isValidPostalCode } from '@/lib/utils/postal';

describe('isValidPostalCode', () => {
  describe('GB postcodes', () => {
    it('accepts SW1A 1AA', () => {
      expect(isValidPostalCode('SW1A 1AA')).toBe(true);
    });

    it('accepts a postcode without a space', () => {
      expect(isValidPostalCode('SW1A1AA')).toBe(true);
    });

    it('accepts lowercase input', () => {
      expect(isValidPostalCode('sw1a 1aa')).toBe(true);
    });

    it('rejects a malformed GB postcode', () => {
      expect(isValidPostalCode('SW1A 1A')).toBe(false);
    });
  });

  describe('US ZIP codes', () => {
    it('accepts a five digit ZIP', () => {
      expect(isValidPostalCode('90210')).toBe(true);
    });

    it('accepts ZIP+4', () => {
      expect(isValidPostalCode('90210-1234')).toBe(true);
    });

    it('rejects a six digit number', () => {
      expect(isValidPostalCode('902101')).toBe(false);
    });

    it('rejects a malformed ZIP+4', () => {
      expect(isValidPostalCode('90210-12')).toBe(false);
    });
  });

  describe('Canadian postal codes', () => {
    it('accepts K1A 0B1', () => {
      expect(isValidPostalCode('K1A 0B1')).toBe(true);
    });

    it('accepts K1A0B1 without a space', () => {
      expect(isValidPostalCode('K1A0B1')).toBe(true);
    });

    it('rejects a code with letters and digits swapped', () => {
      expect(isValidPostalCode('1K1 B0B')).toBe(false);
    });
  });

  describe('Australian postcodes', () => {
    it('accepts 2000', () => {
      expect(isValidPostalCode('2000')).toBe(true);
    });

    it('rejects a three digit number', () => {
      expect(isValidPostalCode('200')).toBe(false);
    });
  });

  describe('Irish Eircodes', () => {
    it('accepts D08 XY00', () => {
      expect(isValidPostalCode('D08 XY00')).toBe(true);
    });

    it('accepts D08XY00 without a space', () => {
      expect(isValidPostalCode('D08XY00')).toBe(true);
    });

    it('accepts the D6W routing key', () => {
      expect(isValidPostalCode('D6W XY00')).toBe(true);
    });

    it('rejects a routing key with no unique identifier', () => {
      expect(isValidPostalCode('D08 XY')).toBe(false);
    });
  });

  describe('invalid values', () => {
    it.each(['1', '12', 'ABCDE', 'not a postcode', ''])(
      'rejects %j',
      (value) => {
        expect(isValidPostalCode(value)).toBe(false);
      },
    );
  });

  it('trims surrounding whitespace before validating', () => {
    expect(isValidPostalCode('  SW1A 1AA  ')).toBe(true);
  });
});

describe('isValidPhone', () => {
  describe('valid numbers', () => {
    it.each([
      '+44 7700 900000',
      '07700 900000',
      '(555) 123-4567',
      '+1 (555) 123-4567',
      '+61 2 1234 5678',
      '+353 1 234 5678',
      '5551234567',
    ])('accepts %j', (value) => {
      expect(isValidPhone(value)).toBe(true);
    });
  });

  describe('invalid numbers', () => {
    it.each([
      '12345',
      'phone',
      '+',
      '',
      '555-CALL-NOW',
      '+1234567890123456',
    ])('rejects %j', (value) => {
      expect(isValidPhone(value)).toBe(false);
    });
  });

  it('trims surrounding whitespace before validating', () => {
    expect(isValidPhone('  +44 7700 900000  ')).toBe(true);
  });
});
