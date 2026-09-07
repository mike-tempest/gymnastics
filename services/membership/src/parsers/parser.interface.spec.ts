import { GoverningBody } from '@club-manager/shared-types';
import {
  ValidationError,
  validateRegistrationNumber,
  validationOptionsForGoverningBody,
} from './parser.interface';

describe('validationOptionsForGoverningBody', () => {
  it.each([GoverningBody.SWIM_ENGLAND, GoverningBody.SCOTTISH_SWIMMING, GoverningBody.SWIM_WALES])(
    'keeps the strict 7-digit format for %s',
    (body) => {
      const options = validationOptionsForGoverningBody(body);
      expect(options.enforceSevenDigitFormat).toBe(true);
    },
  );

  it('keeps the SE number label for Swim England', () => {
    expect(
      validationOptionsForGoverningBody(GoverningBody.SWIM_ENGLAND).registrationNumberLabel,
    ).toBe('SE number');
  });

  it('does not enforce the 7-digit format for British Gymnastics', () => {
    // BG publishes no membership number format, so the SE-style check would
    // reject valid BG numbers.
    const options = validationOptionsForGoverningBody(GoverningBody.BRITISH_GYMNASTICS);
    expect(options.enforceSevenDigitFormat).toBe(false);
    expect(options.registrationNumberLabel).toBe('BG membership number');
  });

  it.each([undefined, null, ''])(
    'follows the product default (British Gymnastics) when the body is %s',
    (body) => {
      const options = validationOptionsForGoverningBody(body as string | null | undefined);
      expect(options.enforceSevenDigitFormat).toBe(false);
      expect(options.registrationNumberLabel).toBe('BG membership number');
    },
  );

  it('never pairs the BG label with the strict format', () => {
    for (const body of [undefined, ...Object.values(GoverningBody)]) {
      const options = validationOptionsForGoverningBody(body);
      if (options.registrationNumberLabel === 'BG membership number') {
        expect(options.enforceSevenDigitFormat).toBe(false);
      }
    }
  });

  it('is lenient for non-UK bodies', () => {
    const options = validationOptionsForGoverningBody(GoverningBody.USA_SWIMMING);
    expect(options.enforceSevenDigitFormat).toBe(false);
  });
});

describe('validateRegistrationNumber', () => {
  const bgOptions = validationOptionsForGoverningBody(GoverningBody.BRITISH_GYMNASTICS);
  const seOptions = validationOptionsForGoverningBody(GoverningBody.SWIM_ENGLAND);

  function validate(value: string, options = bgOptions): ValidationError[] {
    const errors: ValidationError[] = [];
    validateRegistrationNumber(value, 1, errors, options);
    return errors;
  }

  it.each(['123456', '1234567', '12345678', '2049683', 'GBR-100234'])(
    'accepts BG membership number %s without a format error',
    (value) => {
      expect(validate(value)).toEqual([]);
    },
  );

  it('does not zero-pad or reject short BG numbers', () => {
    expect(validate('4821')).toEqual([]);
  });

  it('still requires a BG membership number', () => {
    const errors = validate('');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('BG membership number is required');
    expect(errors[0].severity).toBe('error');
  });

  it('still caps BG membership numbers at 20 characters', () => {
    const errors = validate('1'.repeat(21));
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('BG membership number must be 20 characters or fewer');
  });

  it('keeps the byte-for-byte Swim England error for SE clubs', () => {
    const errors = validate('123456', seOptions);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('SE number must be exactly 7 digits');
  });

  it('accepts a 7-digit number for SE clubs', () => {
    expect(validate('1234567', seOptions)).toEqual([]);
  });
});
