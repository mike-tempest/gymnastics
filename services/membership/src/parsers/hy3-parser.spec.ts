import { HY3Parser } from './hy3-parser';
import { ParsedMeetData, validationOptionsForGoverningBody } from './parser.interface';

describe('HY3Parser', () => {
  let parser: HY3Parser;

  beforeEach(() => {
    parser = new HY3Parser();
  });

  /** Use the parser's own generator to build known-good test data */
  function buildEntryFile(): string {
    return parser.generateEntryFile({
      meetName: 'Kent County Championships 2026',
      meetDate: new Date(2026, 2, 20),
      teamName: 'RTW MONSON SC',
      teamCode: 'RTW',
      country: 'UK',
      entries: [
        {
          swimmer: {
            seNumber: '1234567',
            lastName: 'Tempest',
            firstName: 'Kassidy',
            gender: 'F',
            dateOfBirth: new Date(2015, 8, 15),
          },
          eventNumber: '01',
          distance: 50,
          stroke: 'Freestyle',
          entryTime: 65.23,
          eventName: '50 Free',
        },
        {
          swimmer: {
            seNumber: '1234567',
            lastName: 'Tempest',
            firstName: 'Kassidy',
            gender: 'F',
            dateOfBirth: new Date(2015, 8, 15),
          },
          eventNumber: '01',
          distance: 100,
          stroke: 'Freestyle',
          entryTime: 74.5,
          eventName: '100 Free',
        },
        {
          swimmer: {
            seNumber: '1234568',
            lastName: 'Johnson',
            firstName: 'Emma',
            gender: 'F',
            dateOfBirth: new Date(2014, 1, 10),
          },
          eventNumber: '01',
          distance: 50,
          stroke: 'Freestyle',
          entryTime: 62.3,
          eventName: '50 Free',
        },
      ],
      results: [],
    });
  }

  function buildResultsFile(): string {
    return parser.generateResultFile({
      meetName: 'Kent County Championships 2026',
      meetDate: new Date(2026, 2, 20),
      teamName: 'RTW MONSON SC',
      teamCode: 'RTW',
      country: 'UK',
      entries: [],
      results: [
        {
          swimmer: {
            seNumber: '1234567',
            lastName: 'Tempest',
            firstName: 'Kassidy',
            gender: 'F',
            dateOfBirth: new Date(2015, 8, 15),
          },
          distance: 50,
          stroke: 'Freestyle',
          time: 40.56,
          place: 2,
          dq: false,
          splits: [40.56],
          eventName: '50 Free',
        },
        {
          swimmer: {
            seNumber: '1234567',
            lastName: 'Tempest',
            firstName: 'Kassidy',
            gender: 'F',
            dateOfBirth: new Date(2015, 8, 15),
          },
          distance: 100,
          stroke: 'Freestyle',
          time: 71.23,
          place: 1,
          dq: false,
          eventName: '100 Free',
        },
        {
          swimmer: {
            seNumber: '1234568',
            lastName: 'Johnson',
            firstName: 'Emma',
            gender: 'F',
            dateOfBirth: new Date(2014, 1, 10),
          },
          distance: 50,
          stroke: 'Freestyle',
          time: 53.4,
          place: 3,
          dq: false,
          eventName: '50 Free',
        },
      ],
    });
  }

  describe('parseEntries', () => {
    it('should parse meet name from B1 record', () => {
      const result = parser.parseEntries(buildEntryFile());
      expect(result.meetName).toContain('Kent County Championships 2026');
    });

    it('should parse team info from C1 record', () => {
      const result = parser.parseEntries(buildEntryFile());
      expect(result.teamName).toContain('RTW MONSON SC');
    });

    it('should parse all entries', () => {
      const result = parser.parseEntries(buildEntryFile());
      // 2 swimmers: first has 2 entries, second has 1 = 3 total
      expect(result.entries).toHaveLength(3);
    });

    it('should parse swimmer details correctly', () => {
      const result = parser.parseEntries(buildEntryFile());
      const first = result.entries[0];

      expect(first.swimmer.seNumber).toBe('1234567');
      expect(first.swimmer.lastName).toBe('Tempest');
      expect(first.swimmer.firstName).toBe('Kassidy');
      expect(first.swimmer.gender).toBe('F');
      expect(first.swimmer.dateOfBirth.getFullYear()).toBe(2015);
    });

    it('should parse stroke from code', () => {
      const result = parser.parseEntries(buildEntryFile());
      expect(result.entries[0].stroke).toBe('Freestyle');
    });

    it('should parse entry times', () => {
      const result = parser.parseEntries(buildEntryFile());
      expect(result.entries[0].entryTime).toBeGreaterThan(0);
    });

    it('should parse distinct swimmers', () => {
      const result = parser.parseEntries(buildEntryFile());
      const unique = new Set(result.entries.map((e) => e.swimmer.seNumber));
      expect(unique.size).toBe(2);
    });

    it('should return empty entries for minimal file', () => {
      const result = parser.parseEntries('A1V3   SWIMLY\nZ0');
      expect(result.entries).toHaveLength(0);
    });
  });

  describe('parseResults', () => {
    it('should parse results from a results file', () => {
      const result = parser.parseResults(buildResultsFile());
      expect(result.results.length).toBeGreaterThan(0);
    });

    it('should parse result places', () => {
      const result = parser.parseResults(buildResultsFile());
      const first = result.results[0];
      expect(first.place).toBeDefined();
      expect(first.dq).toBe(false);
    });

    it('should parse result times', () => {
      const result = parser.parseResults(buildResultsFile());
      const first = result.results[0];
      expect(first.time).toBeGreaterThan(0);
    });

    it('should parse split times from G1 records', () => {
      const result = parser.parseResults(buildResultsFile());
      // First result has a G1 splits record
      const first = result.results[0];
      expect(first.splits).toBeDefined();
      expect(first.splits!.length).toBeGreaterThan(0);
    });
  });

  describe('parseSwimmerRecord', () => {
    it('should parse a valid D1 swimmer record', () => {
      const line =
        'D11234567Tempest             Kassidy             F09152015RTW MONSON SC                     ';
      const result = parser.parseSwimmerRecord(line, 1);

      expect(result.seNumber).toBe('1234567');
      expect(result.lastName).toBe('Tempest');
      expect(result.firstName).toBe('Kassidy');
      expect(result.gender).toBe('F');
      expect(result.dateOfBirth.getFullYear()).toBe(2015);
      expect(result.dateOfBirth.getMonth()).toBe(8); // September = 8
      expect(result.dateOfBirth.getDate()).toBe(15);
    });

    it('should accept an alphanumeric registration number (non-UK bodies)', () => {
      const line =
        'D1AB12345Tempest             Kassidy             F09152015RTW MONSON SC                     ';
      const result = parser.parseSwimmerRecord(line, 1);
      expect(result.seNumber).toBe('AB12345');
    });

    it('should throw for a missing registration number', () => {
      const line =
        'D1       Tempest             Kassidy             F09152015RTW MONSON SC                     ';
      expect(() => parser.parseSwimmerRecord(line, 1)).toThrow('Missing registration number');
    });
  });

  describe('parseHY3Date', () => {
    it('should parse MMDDYYYY format', () => {
      const date = parser.parseHY3Date('09152015');
      expect(date.getFullYear()).toBe(2015);
      expect(date.getMonth()).toBe(8);
      expect(date.getDate()).toBe(15);
    });

    it('should throw for invalid date string', () => {
      expect(() => parser.parseHY3Date('invalid')).toThrow();
    });

    it('should throw for short date string', () => {
      expect(() => parser.parseHY3Date('0915')).toThrow();
    });
  });

  describe('parseHY3Time', () => {
    it('should parse MMSSHH format to seconds', () => {
      expect(parser.parseHY3Time('010523')).toBeCloseTo(65.23);
    });

    it('should parse zero-minute times', () => {
      expect(parser.parseHY3Time('005999')).toBeCloseTo(59.99);
    });

    it('should parse sub-minute times', () => {
      expect(parser.parseHY3Time('003450')).toBeCloseTo(34.5);
    });

    it('should return 0 for NT (no time)', () => {
      expect(parser.parseHY3Time('NT')).toBe(0);
    });

    it('should return 0 for empty string', () => {
      expect(parser.parseHY3Time('')).toBe(0);
    });

    it('should throw for invalid seconds (>=60)', () => {
      expect(() => parser.parseHY3Time('016523')).toThrow('seconds must be < 60');
    });

    it('should throw for invalid hundredths (>=100)', () => {
      // This would never parse because we only take 6 chars, but test the range check
      expect(() => parser.parseHY3Time('0100FF')).toThrow();
    });
  });

  describe('generateEntryFile', () => {
    it('should generate a valid HY3 entry file', () => {
      const data: ParsedMeetData = {
        meetName: 'Test Meet 2026',
        meetDate: new Date(2026, 2, 20),
        teamName: 'TEST SC',
        teamCode: 'TEST',
        country: 'UK',
        entries: [
          {
            swimmer: {
              seNumber: '1234567',
              lastName: 'Smith',
              firstName: 'John',
              gender: 'M' as const,
              dateOfBirth: new Date(2012, 4, 15),
            },
            distance: 50,
            stroke: 'Freestyle',
            entryTime: 35.5,
            eventName: '50 Free',
          },
        ],
        results: [],
      };

      const output = parser.generateEntryFile(data);

      expect(output).toContain('A1V3');
      expect(output).toContain('Test Meet 2026');
      expect(output).toContain('TEST SC');
      expect(output).toContain('Smith');
      expect(output).toContain('John');
      expect(output).toContain('1234567');
      expect(output).toContain('50 Free');
      expect(output).toContain('Z0');
    });

    it('should round-trip parse/generate entry file', () => {
      const data: ParsedMeetData = {
        meetName: 'Round Trip Meet',
        meetDate: new Date(2026, 5, 1),
        teamName: 'SWIM SC',
        teamCode: 'SWIM',
        country: 'UK',
        entries: [
          {
            swimmer: {
              seNumber: '9876543',
              lastName: 'Jones',
              firstName: 'Sarah',
              gender: 'F' as const,
              dateOfBirth: new Date(2011, 3, 20),
            },
            distance: 100,
            stroke: 'Backstroke',
            entryTime: 78.45,
            eventName: '100 Back',
          },
        ],
        results: [],
      };

      const generated = parser.generateEntryFile(data);
      const reparsed = parser.parseEntries(generated);

      expect(reparsed.meetName).toContain('Round Trip Meet');
      expect(reparsed.entries).toHaveLength(1);
      expect(reparsed.entries[0].swimmer.seNumber).toBe('9876543');
      expect(reparsed.entries[0].swimmer.lastName).toBe('Jones');
      expect(reparsed.entries[0].stroke).toBe('Backstroke');
    });

    it('writes Hy-Tek alpha-3 country codes and round-trips them', () => {
      const base: ParsedMeetData = {
        meetName: 'Country Codes Meet',
        meetDate: new Date(2026, 5, 1),
        teamName: 'SWIM SC',
        teamCode: 'SWIM',
        entries: [
          {
            swimmer: {
              seNumber: '9876543',
              lastName: 'Jones',
              firstName: 'Sarah',
              gender: 'F' as const,
              dateOfBirth: new Date(2011, 3, 20),
            },
            distance: 100,
            stroke: 'Backstroke',
            entryTime: 78.45,
            eventName: '100 Back',
          },
        ],
        results: [],
      };

      // Alpha-2 club countries map to alpha-3; the legacy 'UK' maps to GBR.
      const gb = parser.parseEntries(parser.generateEntryFile({ ...base, country: 'GB' }));
      expect(gb.country).toBe('GBR');
      const legacyUk = parser.parseEntries(parser.generateEntryFile({ ...base, country: 'UK' }));
      expect(legacyUk.country).toBe('GBR');
      const au = parser.parseEntries(parser.generateEntryFile({ ...base, country: 'AU' }));
      expect(au.country).toBe('AUS');
      // Already alpha-3 codes pass through unchanged; missing defaults to GBR.
      const aus = parser.parseEntries(parser.generateEntryFile({ ...base, country: 'AUS' }));
      expect(aus.country).toBe('AUS');
      const none = parser.parseEntries(parser.generateEntryFile({ ...base, country: undefined }));
      expect(none.country).toBe('GBR');
    });
  });

  describe('generateResultFile', () => {
    it('should generate a valid HY3 results file', () => {
      const data: ParsedMeetData = {
        meetName: 'Test Results Meet',
        meetDate: new Date(2026, 2, 20),
        teamName: 'TEST SC',
        teamCode: 'TEST',
        entries: [],
        results: [
          {
            swimmer: {
              seNumber: '1234567',
              lastName: 'Smith',
              firstName: 'John',
              gender: 'M' as const,
              dateOfBirth: new Date(2012, 4, 15),
            },
            distance: 50,
            stroke: 'Freestyle',
            time: 34.56,
            place: 1,
            dq: false,
            splits: [34.56],
          },
        ],
      };

      const output = parser.generateResultFile(data);
      expect(output).toContain('A1V3');
      expect(output).toContain('Smith');
      expect(output).toContain('Z0');
    });
  });

  describe('validate', () => {
    it('should pass validation for valid data', () => {
      const data: ParsedMeetData = {
        meetName: 'Test',
        entries: [
          {
            swimmer: {
              seNumber: '1234567',
              lastName: 'Test',
              firstName: 'Swimmer',
              gender: 'M' as const,
              dateOfBirth: new Date(2010, 0, 1),
            },
            distance: 50,
            stroke: 'Freestyle',
            entryTime: 35.0,
          },
        ],
        results: [],
      };

      const validation = parser.validate(data);
      expect(validation.valid).toBe(true);
    });

    it('should report errors for invalid SE number', () => {
      const data: ParsedMeetData = {
        meetName: 'Test',
        entries: [
          {
            swimmer: {
              seNumber: 'INVALID',
              lastName: 'Test',
              firstName: 'Swimmer',
              gender: 'M' as const,
              dateOfBirth: new Date(2010, 0, 1),
            },
            distance: 50,
            stroke: 'Freestyle',
            entryTime: 35.0,
          },
        ],
        results: [],
      };

      const validation = parser.validate(data);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.field === 'seNumber')).toBe(true);
      // GB regression bar: the exact previous Swim England error copy.
      expect(validation.errors[0].message).toBe('SE number must be exactly 7 digits');
    });

    it('accepts a non-7-digit member number for an Australian club', () => {
      const data: ParsedMeetData = {
        meetName: 'NSW Country Championships',
        entries: [
          {
            swimmer: {
              seNumber: 'AUS12345',
              lastName: 'Test',
              firstName: 'Swimmer',
              gender: 'M' as const,
              dateOfBirth: new Date(2010, 0, 1),
            },
            distance: 50,
            stroke: 'Freestyle',
            entryTime: 35.0,
          },
        ],
        results: [],
      };

      const validation = parser.validate(
        data,
        validationOptionsForGoverningBody('SWIMMING_AUSTRALIA'),
      );
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('still requires a non-empty number of at most 20 characters for AU clubs', () => {
      const buildData = (seNumber: string): ParsedMeetData => ({
        meetName: 'Test',
        entries: [
          {
            swimmer: {
              seNumber,
              lastName: 'Test',
              firstName: 'Swimmer',
              gender: 'M' as const,
              dateOfBirth: new Date(2010, 0, 1),
            },
            distance: 50,
            stroke: 'Freestyle',
            entryTime: 35.0,
          },
        ],
        results: [],
      });
      const options = validationOptionsForGoverningBody('SWIMMING_AUSTRALIA');

      const missing = parser.validate(buildData(''), options);
      expect(missing.valid).toBe(false);
      expect(missing.errors[0].message).toBe('Member number is required');

      const tooLong = parser.validate(buildData('X'.repeat(21)), options);
      expect(tooLong.valid).toBe(false);
      expect(tooLong.errors[0].message).toBe('Member number must be 20 characters or fewer');
    });

    it('should report errors for zero time', () => {
      const data: ParsedMeetData = {
        meetName: 'Test',
        entries: [
          {
            swimmer: {
              seNumber: '1234567',
              lastName: 'Test',
              firstName: 'Swimmer',
              gender: 'M' as const,
              dateOfBirth: new Date(2010, 0, 1),
            },
            distance: 50,
            stroke: 'Freestyle',
            entryTime: 0,
          },
        ],
        results: [],
      };

      const validation = parser.validate(data);
      expect(validation.valid).toBe(false);
    });

    it('should warn for unrealistic time', () => {
      const data: ParsedMeetData = {
        meetName: 'Test',
        entries: [
          {
            swimmer: {
              seNumber: '1234567',
              lastName: 'Test',
              firstName: 'Swimmer',
              gender: 'M' as const,
              dateOfBirth: new Date(2010, 0, 1),
            },
            distance: 50,
            stroke: 'Freestyle',
            entryTime: 2000, // > 30 min
          },
        ],
        results: [],
      };

      const validation = parser.validate(data);
      expect(validation.errors.some((e) => e.severity === 'warning')).toBe(true);
    });
  });
});
