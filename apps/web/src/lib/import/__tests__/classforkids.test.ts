import { readFileSync } from 'fs';
import { join } from 'path';

import {
  type ClassForKidsUpload,
  classForKidsRowKey,
  detectClassForKidsFileRole,
  extractClassForKidsRows,
  splitFullName,
} from '../classforkids';
import { parseCsvText } from '../spreadsheet';

/**
 * Fixture provenance: docs/04-Incumbent-Landscape-Pricing-and-Exports.md,
 * section 1, records that ClassForKids has "No single 'export everything'
 * function", only per-screen spreadsheets: a Financials Summary export with
 * "date/time, amount, payment method, payment type, transaction number, fees
 * charged and income columns", contacts compiled from the Schedule page whose
 * "field-level columns are not documented", and register downloads. The three
 * fixtures reproduce that shape: two files that carry names with different
 * headers, and one money-only financial summary. Names are invented.
 */
function upload(fileName: string): ClassForKidsUpload {
  const text = readFileSync(join(__dirname, '__fixtures__', fileName), 'utf8');
  return { name: fileName, sheet: parseCsvText(text) };
}

const contacts = () => upload('classforkids-contacts.csv');
const register = () => upload('classforkids-register.csv');
const financial = () => upload('classforkids-financial-summary.csv');

describe('splitFullName', () => {
  it('splits a plain first-then-last name', () => {
    expect(splitFullName('Olivia Hartley')).toEqual({ first: 'Olivia', last: 'Hartley' });
  });

  it('splits a surname-first name written with a comma', () => {
    expect(splitFullName('Rhys-Jones, Amelia')).toEqual({ first: 'Amelia', last: 'Rhys-Jones' });
  });

  it('keeps a double-barrelled surname together', () => {
    expect(splitFullName('Amelia Rhys Jones')).toEqual({ first: 'Amelia', last: 'Rhys Jones' });
  });

  it('handles a single word and empty input', () => {
    expect(splitFullName('Olivia')).toEqual({ first: 'Olivia', last: '' });
    expect(splitFullName('   ')).toEqual({ first: '', last: '' });
  });
});

describe('detectClassForKidsFileRole', () => {
  it('treats a file with a child name column as a source of gymnasts', () => {
    expect(detectClassForKidsFileRole(contacts().sheet.headers)).toBe('people');
    expect(detectClassForKidsFileRole(register().sheet.headers)).toBe('people');
  });

  it('treats a money-only financial summary as financial', () => {
    expect(detectClassForKidsFileRole(financial().sheet.headers)).toBe('financial');
  });

  it('reports an unrecognisable file rather than guessing', () => {
    expect(detectClassForKidsFileRole(['Wibble', 'Wobble'])).toBe('unknown');
  });
});

describe('classForKidsRowKey', () => {
  it('identifies a gymnast by parent email plus name, ignoring case and spacing', () => {
    const a = classForKidsRowKey({
      member_first_name: 'Olivia',
      member_last_name: 'Hartley',
      parent_email: 'sarah.hartley@example.co.uk',
      parent_name: 'Sarah Hartley',
    });
    const b = classForKidsRowKey({
      member_first_name: '  olivia ',
      member_last_name: 'HARTLEY',
      parent_email: 'Sarah.Hartley@example.co.uk',
      parent_name: '',
    });
    expect(a).toBe(b);
  });

  it('falls back to parent name when the file carries no email', () => {
    const withName = classForKidsRowKey({
      member_first_name: 'Noah',
      member_last_name: 'Adeyemi',
      parent_email: '',
      parent_name: 'Grace Adeyemi',
    });
    expect(withName).toBe('grace adeyemi|noah|adeyemi');
  });

  it('keeps two children of the same parent apart', () => {
    const olivia = classForKidsRowKey({
      member_first_name: 'Olivia',
      member_last_name: 'Hartley',
      parent_email: 'sarah.hartley@example.co.uk',
      parent_name: '',
    });
    const thomas = classForKidsRowKey({
      member_first_name: 'Thomas',
      member_last_name: 'Hartley',
      parent_email: 'sarah.hartley@example.co.uk',
      parent_name: '',
    });
    expect(olivia).not.toBe(thomas);
  });
});

describe('extractClassForKidsRows', () => {
  it('pulls parent, child and class out of a contacts spreadsheet', () => {
    const { rows } = extractClassForKidsRows([contacts()]);

    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      member_first_name: 'Olivia',
      member_last_name: 'Hartley',
      date_of_birth: '2014-05-12',
      gender: 'F',
      parent_name: 'Sarah Hartley',
      parent_email: 'sarah.hartley@example.co.uk',
      parent_phone: '07700 900123',
      squad_name: 'Recreational Gymnastics Level 1',
      venue: 'Meadow Lane Sports Hall',
      day: 'Monday',
      postcode: 'LS6 3AB',
      missing: [],
    });
  });

  it('splits a surname-first child name cell', () => {
    const { rows } = extractClassForKidsRows([contacts()]);
    const amelia = rows.find((row) => row.member_first_name === 'Amelia');

    expect(amelia?.member_last_name).toBe('Rhys-Jones');
  });

  it('reads UK day-first dates and normalises gender words', () => {
    const { rows } = extractClassForKidsRows([contacts()]);
    const thomas = rows.find((row) => row.member_first_name === 'Thomas');

    expect(thomas?.date_of_birth).toBe('2012-09-30');
    expect(thomas?.gender).toBe('M');
  });

  it('names the required fields a row still lacks instead of dropping it', () => {
    const { rows } = extractClassForKidsRows([contacts()]);
    const noah = rows.find((row) => row.member_first_name === 'Noah');

    expect(noah?.missing).toEqual(['date_of_birth', 'gender', 'parent_email']);
  });

  it('merges the same gymnast across several files', () => {
    const { rows, mergedRows } = extractClassForKidsRows([contacts(), register()]);

    // Four children from the contacts file plus Isla from the register.
    expect(rows).toHaveLength(5);
    expect(mergedRows).toBe(2);
    expect(rows.filter((row) => row.member_first_name === 'Olivia')).toHaveLength(1);
  });

  it('records a second class rather than duplicating the gymnast', () => {
    const { rows } = extractClassForKidsRows([contacts(), register()]);
    const olivia = rows.find((row) => row.member_first_name === 'Olivia');

    expect(olivia?.squad_name).toBe('Recreational Gymnastics Level 1');
    expect(olivia?.additional_classes).toEqual(['Trampoline Taster']);
    expect(olivia?.sources).toEqual(['classforkids-contacts.csv', 'classforkids-register.csv']);
  });

  it('does not record the same class twice when two files agree', () => {
    const { rows } = extractClassForKidsRows([contacts(), register()]);
    const amelia = rows.find((row) => row.member_first_name === 'Amelia');

    expect(amelia?.squad_name).toBe('Pre-School Gymnastics');
    expect(amelia?.additional_classes).toEqual([]);
  });

  it('fills a gap in one file from another rather than overwriting good data', () => {
    const sparse: ClassForKidsUpload = {
      name: 'extra.csv',
      sheet: parseCsvText(
        'Child Name,Parent Email,Postcode\nOlivia Hartley,sarah.hartley@example.co.uk,LS6 9ZZ\n'
      ),
    };
    const { rows } = extractClassForKidsRows([contacts(), sparse]);
    const olivia = rows.find((row) => row.member_first_name === 'Olivia');

    // The contacts file was read first, so its postcode wins.
    expect(olivia?.postcode).toBe('LS6 3AB');
  });

  it('takes no gymnasts from a money-only financial summary', () => {
    const { rows, files } = extractClassForKidsRows([financial()]);

    expect(rows).toHaveLength(0);
    expect(files[0]).toMatchObject({ role: 'financial', peopleRows: 0, rowCount: 3 });
  });

  it('totals money columns as informational context only', () => {
    const { amounts } = extractClassForKidsRows([financial()]);

    expect(amounts).toEqual([
      { file: 'classforkids-financial-summary.csv', column: 'Amount', rows: 3, total: 102.5 },
      { file: 'classforkids-financial-summary.csv', column: 'Income', rows: 3, total: 98.83 },
    ]);
  });

  it('reports which headers each file contributed and which were ignored', () => {
    const { files } = extractClassForKidsRows([contacts(), financial()]);

    expect(files[0].role).toBe('people');
    expect(files[0].peopleRows).toBe(4);
    expect(files[0].mappedHeaders).toEqual(
      expect.arrayContaining(['Child Name', 'Class', 'Parent', 'Parent Email'])
    );
    expect(files[1].ignoredHeaders).toEqual(
      expect.arrayContaining(['Payment Method', 'Transaction Number'])
    );
  });

  it('handles being given no files at all', () => {
    expect(extractClassForKidsRows([])).toEqual({
      files: [],
      rows: [],
      amounts: [],
      mergedRows: 0,
    });
  });
});
