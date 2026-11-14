import { formatMoney, percentChange } from '@pms/types';

export const money = (minor: number | null | undefined, currency: string | null): string =>
  minor === null || minor === undefined ? '—' : formatMoney(minor, currency ?? 'PHP');
export const pct = (value: number | null | undefined): string => (value === null || value === undefined ? '—' : `${value}%`);
export const shortDate = (iso: string): string => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** "+12.5% vs previous" text and whether it is good news. lowerIsBetter flips the colour for costs. */
export function delta(current: number | null, previous: number | null, lowerIsBetter = false): { text: string; tone: 'good' | 'bad' | 'flat' | 'none' } {
  if (current === null || previous === null) return { text: 'no comparison', tone: 'none' };
  const change = percentChange(current, previous);
  if (change === null) return { text: previous === 0 && current === 0 ? 'no change' : 'new (nothing before)', tone: 'none' };
  if (change === 0) return { text: '0% vs previous', tone: 'flat' };
  const up = change > 0;
  return { text: `${up ? '+' : ''}${change}% vs previous`, tone: up !== lowerIsBetter ? 'good' : 'bad' };
}

/** Whole pesos with two decimals, as a number, for spreadsheets. */
export const pesos = (minor: number | null): number | null => (minor === null ? null : Number((minor / 100).toFixed(2)));
