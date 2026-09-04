/**
 * Client-side CSV export utility.
 * Converts an array of plain objects to a CSV file and triggers a browser download.
 */
export function downloadCsv(
  filename: string,
  rows: Record<string, string | number | boolean>[]
): void {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);

  const escape = (value: string | number | boolean): string => {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const csvRows = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escape(row[header] ?? '')).join(',')),
  ];

  const csv = csvRows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
}
