import { isISO8601, ValidateBy, ValidationOptions } from 'class-validator';

export const DATE_OF_BIRTH_ERROR = 'Date of birth must be a valid date on or before today';

// Birth dates are calendar dates, not instants. Use the current UTC date on
// each validation rather than capturing a maximum date when the server starts.
export function isValidDateOfBirth(value: unknown, now = new Date()): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    isISO8601(value, { strict: true }) &&
    value <= now.toISOString().slice(0, 10)
  );
}

export function IsDateOfBirth(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isDateOfBirth',
      validator: {
        validate: (value: unknown) => isValidDateOfBirth(value),
        defaultMessage: () => DATE_OF_BIRTH_ERROR,
      },
    },
    options,
  );
}
