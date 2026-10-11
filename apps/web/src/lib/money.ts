/** "3,500.50" -> 350050 centavos. null = empty, NaN = invalid (more than 2 decimals, letters...). Never floating point sums. */
export function pesosToMinor(value: string): number | null {
  const cleaned = value.replace(/,/g, '').trim();
  if (cleaned === '') return null;
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return Number.NaN;
  return Math.round(Number(cleaned) * 100);
}

export const minorToPesos = (minor: number): string => (minor / 100).toFixed(2);

export const newIdempotencyKey = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`;
