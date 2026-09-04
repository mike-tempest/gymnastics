/**
 * Auto-detect file format and return the appropriate parser.
 */

import { FileFormat, FileParser } from './parser.interface';
import { HY3Parser } from './hy3-parser';
import { SportSystemsParser } from './sportsystems-parser';

export class ParserFactory {
  /**
   * Detect file format from filename extension and/or content.
   */
  static detectFormat(fileName: string, content: string): FileFormat {
    const ext = fileName.split('.').pop()?.toLowerCase();

    // Extension-based detection
    if (ext === 'hy3') return FileFormat.HY3;
    if (ext === 'csv' || ext === 'ss') return FileFormat.SPORTSYSTEMS;

    // Content-based detection (fallback)
    const trimmed = content.trimStart();
    if (trimmed.startsWith('A1')) return FileFormat.HY3;
    if (
      trimmed.startsWith('ClubCode') ||
      trimmed.startsWith('Event,') ||
      trimmed.startsWith('"ClubCode')
    ) {
      return FileFormat.SPORTSYSTEMS;
    }

    throw new Error(`Unknown file format for "${fileName}". Supported formats: .hy3, .csv, .ss`);
  }

  /**
   * Get the appropriate parser for a given format.
   */
  static getParser(format: FileFormat): FileParser {
    switch (format) {
      case FileFormat.HY3:
        return new HY3Parser();
      case FileFormat.SPORTSYSTEMS:
        return new SportSystemsParser();
      default:
        throw new Error(`No parser available for format: ${format}`);
    }
  }
}
