import { csvBodyLine, csvHeaderLine, escapeCsvField, formatCsvValue, toCsv } from './csv-writer';

describe('csv-writer', () => {
  describe('escapeCsvField', () => {
    it('leaves an ordinary value alone', () => {
      expect(escapeCsvField('Ava Nolan')).toBe('Ava Nolan');
    });

    it('prefixes anything a spreadsheet would evaluate as a formula', () => {
      // The apostrophe is consumed by the spreadsheet on open, so the club
      // still sees the value it entered while the formula never runs.
      expect(escapeCsvField('=cmd|calc')).toBe("'=cmd|calc");
      expect(escapeCsvField('+1234567')).toBe("'+1234567");
      expect(escapeCsvField('-1')).toBe("'-1");
      expect(escapeCsvField('@SUM(A1)')).toBe("'@SUM(A1)");
    });

    it('quotes a value containing a comma, a quote or a newline', () => {
      expect(escapeCsvField('Nolan, Jr')).toBe('"Nolan, Jr"');
      expect(escapeCsvField('Club "own" badges')).toBe('"Club ""own"" badges"');
      expect(escapeCsvField('line one\nline two')).toBe('"line one\nline two"');
    });

    it('quotes a guarded value that also needs quoting', () => {
      expect(escapeCsvField('=a,b')).toBe('"\'=a,b"');
    });
  });

  describe('formatCsvValue', () => {
    it('writes null and undefined as an empty cell', () => {
      expect(formatCsvValue(null)).toBe('');
      expect(formatCsvValue(undefined)).toBe('');
    });

    it('writes a date in full ISO 8601 so it round-trips', () => {
      expect(formatCsvValue(new Date('2026-09-01T10:30:00.000Z'))).toBe('2026-09-01T10:30:00.000Z');
    });

    it('writes an unparseable date as an empty cell rather than "Invalid Date"', () => {
      expect(formatCsvValue(new Date('not a date'))).toBe('');
    });

    it('writes numbers and booleans plainly', () => {
      expect(formatCsvValue(0)).toBe('0');
      expect(formatCsvValue(12.5)).toBe('12.5');
      expect(formatCsvValue(false)).toBe('false');
    });

    it('writes a jsonb column as JSON', () => {
      expect(formatCsvValue({ notifyNewMember: true })).toBe('{"notifyNewMember":true}');
      expect(formatCsvValue(['pre_school'])).toBe('["pre_school"]');
    });
  });

  describe('toCsv', () => {
    it('writes a header and one line per row, ending on a newline', () => {
      const csv = toCsv(
        ['first_name', 'squad'],
        [
          { first_name: 'Ava', squad: 'Explore 3' },
          { first_name: 'Ben', squad: null },
        ],
      );

      expect(csv).toBe('first_name,squad\nAva,Explore 3\nBen,\n');
    });

    it('writes only a header when there are no rows', () => {
      expect(toCsv(['a', 'b'], [])).toBe('a,b\n');
    });

    it('ignores properties that are not in the column list', () => {
      const csv = toCsv(['a'], [{ a: '1', password_hash: 'secret' }]);
      expect(csv).toBe('a\n1\n');
    });

    it('composes from the same line helpers the paged export uses', () => {
      const columns = ['a', 'b'];
      const rows = [{ a: '1', b: '2' }];
      const pieced = [csvHeaderLine(columns), ...rows.map((row) => csvBodyLine(columns, row))];
      expect(`${pieced.join('\n')}\n`).toBe(toCsv(columns, rows));
    });
  });
});
