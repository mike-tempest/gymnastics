import { ParserFactory } from './parser-factory';
import { FileFormat } from './parser.interface';
import { HY3Parser } from './hy3-parser';
import { SportSystemsParser } from './sportsystems-parser';

describe('ParserFactory', () => {
  describe('detectFormat', () => {
    it('should detect HY3 format from .hy3 extension', () => {
      expect(ParserFactory.detectFormat('results.hy3', '')).toBe(FileFormat.HY3);
    });

    it('should detect SportSystems format from .csv extension', () => {
      expect(ParserFactory.detectFormat('results.csv', '')).toBe(FileFormat.SPORTSYSTEMS);
    });

    it('should detect SportSystems format from .ss extension', () => {
      expect(ParserFactory.detectFormat('results.ss', '')).toBe(FileFormat.SPORTSYSTEMS);
    });

    it('should detect HY3 format from content starting with A1', () => {
      expect(ParserFactory.detectFormat('unknown.txt', 'A1V3   TEAM MANAGER')).toBe(FileFormat.HY3);
    });

    it('should detect SportSystems format from content with ClubCode header', () => {
      expect(ParserFactory.detectFormat('unknown.txt', 'ClubCode,ClubName,SwimmerSENumber')).toBe(
        FileFormat.SPORTSYSTEMS,
      );
    });

    it('should detect SportSystems format from content starting with Event,', () => {
      expect(ParserFactory.detectFormat('unknown.txt', 'Event,Heat,Lane')).toBe(
        FileFormat.SPORTSYSTEMS,
      );
    });

    it('should throw for unknown format', () => {
      expect(() => ParserFactory.detectFormat('unknown.xyz', 'random content')).toThrow(
        'Unknown file format',
      );
    });
  });

  describe('getParser', () => {
    it('should return HY3Parser for HY3 format', () => {
      const parser = ParserFactory.getParser(FileFormat.HY3);
      expect(parser).toBeInstanceOf(HY3Parser);
    });

    it('should return SportSystemsParser for SportSystems format', () => {
      const parser = ParserFactory.getParser(FileFormat.SPORTSYSTEMS);
      expect(parser).toBeInstanceOf(SportSystemsParser);
    });
  });
});
