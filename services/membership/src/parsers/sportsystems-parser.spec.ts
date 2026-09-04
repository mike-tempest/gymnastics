import * as fs from 'fs';
import * as path from 'path';
import { SportSystemsParser } from './sportsystems-parser';
import { validationOptionsForGoverningBody } from './parser.interface';

describe('SportSystemsParser', () => {
  let parser: SportSystemsParser;

  beforeEach(() => {
    parser = new SportSystemsParser();
  });

  const testDataDir = path.join(__dirname, '../../test/test-data/sportsystems');

  describe('parseEntries', () => {
    it('should parse a valid entry CSV file', () => {
      const content = fs.readFileSync(path.join(testDataDir, 'entry-club-open-meet.csv'), 'utf-8');
      const result = parser.parseEntries(content);

      expect(result.entries).toHaveLength(6);
      expect(result.teamName).toBe('RTW Monson SC');
      expect(result.teamCode).toBe('RTWM');
    });

    it('should parse swimmer details correctly', () => {
      const content = fs.readFileSync(path.join(testDataDir, 'entry-club-open-meet.csv'), 'utf-8');
      const result = parser.parseEntries(content);

      const firstEntry = result.entries[0];
      expect(firstEntry.swimmer.seNumber).toBe('1234567');
      expect(firstEntry.swimmer.lastName).toBe('Tempest');
      expect(firstEntry.swimmer.firstName).toBe('Kassidy');
      expect(firstEntry.swimmer.gender).toBe('F');
    });

    it('should parse entry times correctly', () => {
      const content = fs.readFileSync(path.join(testDataDir, 'entry-club-open-meet.csv'), 'utf-8');
      const result = parser.parseEntries(content);

      // First entry: 1:05.23 = 65.23 seconds
      expect(result.entries[0].entryTime).toBeCloseTo(65.23);
    });

    it('should parse UK date format (DD/MM/YYYY)', () => {
      const content = fs.readFileSync(path.join(testDataDir, 'entry-club-open-meet.csv'), 'utf-8');
      const result = parser.parseEntries(content);

      const dob = result.entries[0].swimmer.dateOfBirth;
      expect(dob.getDate()).toBe(15);
      expect(dob.getMonth()).toBe(8); // September = 8
      expect(dob.getFullYear()).toBe(2015);
    });

    it('should parse distance and stroke from dedicated columns', () => {
      const content = fs.readFileSync(path.join(testDataDir, 'entry-club-open-meet.csv'), 'utf-8');
      const result = parser.parseEntries(content);

      expect(result.entries[0].distance).toBe(50);
      expect(result.entries[0].stroke).toBe('Freestyle');
    });

    it('should handle different stroke names', () => {
      const content = fs.readFileSync(path.join(testDataDir, 'entry-club-open-meet.csv'), 'utf-8');
      const result = parser.parseEntries(content);

      // Find the backstroke entry
      const backEntry = result.entries.find((e) => e.stroke === 'Backstroke');
      expect(backEntry).toBeDefined();
      expect(backEntry!.distance).toBe(100);

      // Find the breaststroke entry
      const breastEntry = result.entries.find((e) => e.stroke === 'Breaststroke');
      expect(breastEntry).toBeDefined();
      expect(breastEntry!.distance).toBe(200);
    });

    it('should throw for empty file', () => {
      expect(() => parser.parseEntries('')).toThrow('Empty file');
    });
  });

  describe('parseResults', () => {
    it('should parse a valid results CSV file', () => {
      const content = fs.readFileSync(
        path.join(testDataDir, 'results-club-open-meet.csv'),
        'utf-8',
      );
      const result = parser.parseResults(content);

      expect(result.results).toHaveLength(7);
    });

    it('should parse result times and places', () => {
      const content = fs.readFileSync(
        path.join(testDataDir, 'results-club-open-meet.csv'),
        'utf-8',
      );
      const result = parser.parseResults(content);

      const firstResult = result.results[0];
      expect(firstResult.swimmer.seNumber).toBe('1234567');
      expect(firstResult.place).toBe(2);
      expect(firstResult.dq).toBe(false);
      expect(firstResult.time).toBeCloseTo(64.56);
    });

    it('should parse heat and lane', () => {
      const content = fs.readFileSync(
        path.join(testDataDir, 'results-club-open-meet.csv'),
        'utf-8',
      );
      const result = parser.parseResults(content);

      const firstResult = result.results[0];
      expect(firstResult.heat).toBe(3);
      expect(firstResult.lane).toBe(4);
    });

    it('should parse split times', () => {
      const content = fs.readFileSync(
        path.join(testDataDir, 'results-club-open-meet.csv'),
        'utf-8',
      );
      const result = parser.parseResults(content);

      // Second result (100 Free) has splits: 31.23;41.07
      const secondResult = result.results[1];
      expect(secondResult.splits).toHaveLength(2);
      expect(secondResult.splits![0]).toBeCloseTo(31.23);
      expect(secondResult.splits![1]).toBeCloseTo(41.07);
    });

    it('should handle results with no splits', () => {
      const content = fs.readFileSync(
        path.join(testDataDir, 'results-club-open-meet.csv'),
        'utf-8',
      );
      const result = parser.parseResults(content);

      // First result (50 Free) has no splits
      const firstResult = result.results[0];
      expect(firstResult.splits).toEqual([]);
    });

    it('should parse event string into distance and stroke', () => {
      const content = fs.readFileSync(
        path.join(testDataDir, 'results-club-open-meet.csv'),
        'utf-8',
      );
      const result = parser.parseResults(content);

      const backResult = result.results.find((r) => r.stroke === 'Backstroke');
      expect(backResult).toBeDefined();
      expect(backResult!.distance).toBe(100);
    });
  });

  describe('parseUKDate', () => {
    it('should parse DD/MM/YYYY format', () => {
      const date = parser.parseUKDate('15/09/2015');
      expect(date.getDate()).toBe(15);
      expect(date.getMonth()).toBe(8); // September
      expect(date.getFullYear()).toBe(2015);
    });

    it('should throw for invalid date format', () => {
      expect(() => parser.parseUKDate('2015-09-15')).toThrow();
    });
  });

  describe('parseSportSystemsTime', () => {
    it('should parse M:SS.HH format', () => {
      expect(parser.parseSportSystemsTime('1:05.23')).toBeCloseTo(65.23);
    });

    it('should parse 0:SS.HH format', () => {
      expect(parser.parseSportSystemsTime('0:45.80')).toBeCloseTo(45.8);
    });

    it('should parse SS.HH format (no minutes)', () => {
      expect(parser.parseSportSystemsTime('34.56')).toBeCloseTo(34.56);
    });

    it('should return 0 for empty string', () => {
      expect(parser.parseSportSystemsTime('')).toBe(0);
    });
  });

  describe('generateEntryFile', () => {
    it('should generate a valid CSV entry file', () => {
      const data = {
        meetName: 'Test Meet',
        teamName: 'TEST SC',
        teamCode: 'TEST',
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

      // Should have header + 1 data row
      const lines = output.split('\n');
      expect(lines).toHaveLength(2);
      expect(lines[0]).toBe(
        'ClubCode,ClubName,SwimmerSENumber,LastName,FirstName,Gender,DOB,Event,Distance,Stroke,EntryTime',
      );
      expect(lines[1]).toContain('1234567');
      expect(lines[1]).toContain('Smith');
      expect(lines[1]).toContain('John');
      expect(lines[1]).toContain('50');
      expect(lines[1]).toContain('Freestyle');
    });

    it('should round-trip parse/generate entry file', () => {
      const content = fs.readFileSync(path.join(testDataDir, 'entry-club-open-meet.csv'), 'utf-8');
      const parsed = parser.parseEntries(content);

      const generated = parser.generateEntryFile(parsed);
      const reparsed = parser.parseEntries(generated);

      expect(reparsed.entries).toHaveLength(parsed.entries.length);
      expect(reparsed.entries[0].swimmer.seNumber).toBe(parsed.entries[0].swimmer.seNumber);
    });
  });

  describe('generateResultFile', () => {
    it('should generate a valid CSV results file', () => {
      const data = {
        meetName: 'Test Meet',
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
            heat: 3,
            lane: 4,
            dq: false,
            splits: [34.56],
          },
        ],
      };

      const output = parser.generateResultFile(data);
      const lines = output.split('\n');

      expect(lines).toHaveLength(2);
      expect(lines[0]).toBe(
        'Event,Heat,Lane,SwimmerSENumber,LastName,FirstName,Time,Place,DQ,Splits',
      );
      expect(lines[1]).toContain('1234567');
      expect(lines[1]).toContain('34.56');
    });
  });

  describe('validate', () => {
    it('should pass validation for valid entry data', () => {
      const content = fs.readFileSync(path.join(testDataDir, 'entry-club-open-meet.csv'), 'utf-8');
      const parsed = parser.parseEntries(content);
      const validation = parser.validate(parsed);

      expect(validation.valid).toBe(true);
      expect(validation.errors.filter((e) => e.severity === 'error')).toHaveLength(0);
    });

    it('should report errors for invalid SE number', () => {
      const data = {
        meetName: 'Test',
        entries: [
          {
            swimmer: {
              seNumber: 'BAD',
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
      const data = {
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
        results: [
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
            time: 34.56,
            place: 1,
            dq: false,
          },
        ],
      };

      const validation = parser.validate(
        data,
        validationOptionsForGoverningBody('SWIMMING_AUSTRALIA'),
      );
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('labels missing member numbers with the AU wording in results', () => {
      const data = {
        meetName: 'Test',
        entries: [],
        results: [
          {
            swimmer: {
              seNumber: '',
              lastName: 'Test',
              firstName: 'Swimmer',
              gender: 'M' as const,
              dateOfBirth: new Date(2010, 0, 1),
            },
            distance: 50,
            stroke: 'Freestyle',
            time: 34.56,
            place: 1,
            dq: false,
          },
        ],
      };

      const validation = parser.validate(
        data,
        validationOptionsForGoverningBody('SWIMMING_AUSTRALIA'),
      );
      expect(validation.valid).toBe(false);
      expect(validation.errors[0].message).toBe('Member number is required');
    });

    it('should report errors for invalid time', () => {
      const data = {
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
            entryTime: -5,
          },
        ],
        results: [],
      };

      const validation = parser.validate(data);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.field === 'entryTime')).toBe(true);
    });
  });
});
