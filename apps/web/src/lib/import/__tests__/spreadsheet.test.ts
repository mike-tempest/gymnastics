import * as XLSX from 'xlsx';

import {
  SpreadsheetParseError,
  excelSerialDateToIso,
  isSupportedImportFile,
  parseCsvText,
  parseWorkbook,
} from '../spreadsheet';

describe('excelSerialDateToIso', () => {
  it('converts 1900-system serials', () => {
    expect(excelSerialDateToIso(38687)).toBe('2005-12-01');
    expect(excelSerialDateToIso(1)).toBe('1900-01-01');
    expect(excelSerialDateToIso(59)).toBe('1900-02-28');
    expect(excelSerialDateToIso(61)).toBe('1900-03-01');
  });

  it('ignores the time-of-day fraction', () => {
    expect(excelSerialDateToIso(38687.75)).toBe('2005-12-01');
  });

  it('returns null for the fictional 29 February 1900', () => {
    expect(excelSerialDateToIso(60)).toBeNull();
  });

  it('handles the 1904 epoch used by Mac-authored workbooks', () => {
    // The same calendar day is 1462 serials lower in the 1904 system.
    expect(excelSerialDateToIso(38687 - 1462, true)).toBe('2005-12-01');
  });

  it('returns null for non-finite or pre-epoch values', () => {
    expect(excelSerialDateToIso(NaN)).toBeNull();
    expect(excelSerialDateToIso(0)).toBeNull();
    expect(excelSerialDateToIso(-5)).toBeNull();
  });
});

describe('isSupportedImportFile', () => {
  it('accepts .csv and .xlsx in any case', () => {
    expect(isSupportedImportFile('roster.csv')).toBe(true);
    expect(isSupportedImportFile('Full Members Report.XLSX')).toBe(true);
    expect(isSupportedImportFile('roster.xls')).toBe(false);
    expect(isSupportedImportFile('roster.pdf')).toBe(false);
  });
});

describe('parseCsvText', () => {
  it('parses headers and rows, trimming header whitespace', () => {
    const parsed = parseCsvText('First Name , Surname\nMia,Chen\n');
    expect(parsed.headers).toEqual(['First Name', 'Surname']);
    expect(parsed.rows).toEqual([{ 'First Name': 'Mia', Surname: 'Chen' }]);
  });

  it('strips a leading BOM from the first header', () => {
    const parsed = parseCsvText('﻿first_name,last_name\nMia,Chen\n');
    expect(parsed.headers[0]).toBe('first_name');
  });

  it('skips empty lines', () => {
    const parsed = parseCsvText('a,b\n1,2\n\n3,4\n');
    expect(parsed.rows).toHaveLength(2);
  });
});

describe('parseWorkbook', () => {
  function workbookBuffer(sheet: XLSX.WorkSheet): ArrayBuffer {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Sheet1');
    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  }

  it('parses the first worksheet with headers and rows', () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['First Name', 'Surname', 'DOB'],
      ['Mia', 'Chen', '14/03/2015'],
      ['Noah', 'Singh', '01/09/2013'],
    ]);
    const parsed = parseWorkbook(workbookBuffer(sheet));
    expect(parsed.headers).toEqual(['First Name', 'Surname', 'DOB']);
    expect(parsed.rows).toEqual([
      { 'First Name': 'Mia', Surname: 'Chen', DOB: '14/03/2015' },
      { 'First Name': 'Noah', Surname: 'Singh', DOB: '01/09/2013' },
    ]);
  });

  it('converts date cells stored as serial numbers', () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['First Name', 'DOB'],
      ['Mia', 0],
    ]);
    sheet.B2 = { t: 'n', v: 38687, z: 'dd/mm/yyyy' };
    const parsed = parseWorkbook(workbookBuffer(sheet));
    expect(parsed.rows[0].DOB).toBe('2005-12-01');
  });

  it('leaves plain numbers untouched', () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['First Name', 'Member Number'],
      ['Mia', 123456],
    ]);
    const parsed = parseWorkbook(workbookBuffer(sheet));
    expect(parsed.rows[0]['Member Number']).toBe('123456');
  });

  it('tolerates a title row and blank rows around the data', () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Full Members Report'],
      [],
      ['First Name', 'Surname'],
      ['Mia', 'Chen'],
      [],
      ['Noah', 'Singh'],
    ]);
    const parsed = parseWorkbook(workbookBuffer(sheet));
    expect(parsed.headers).toEqual(['First Name', 'Surname']);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[1]).toEqual({ 'First Name': 'Noah', Surname: 'Singh' });
  });

  it('makes duplicate and empty headers unique', () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Name', 'Name', ''],
      ['Mia', 'Chen', 'x'],
    ]);
    const parsed = parseWorkbook(workbookBuffer(sheet));
    expect(parsed.headers).toEqual(['Name', 'Name (2)', 'Column 3']);
  });

  it('throws a SpreadsheetParseError for a corrupt file', () => {
    // Starts with the zip magic bytes but is not a valid archive.
    const garbage = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x01, 0x02]).buffer;
    expect(() => parseWorkbook(garbage)).toThrow(SpreadsheetParseError);
  });
});
