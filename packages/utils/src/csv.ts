/**
 * One CSV cell. Text that starts with = + - @ (or a tab/return) would be run as a formula by Excel or Sheets, so it
 * gets a leading apostrophe ("CSV injection"). Numbers are written as numbers, so a negative amount stays a number.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export const toCsv = (rows: ReadonlyArray<ReadonlyArray<unknown>>): string => rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
