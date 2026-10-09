/** Pure date and money helpers shared by the API and the web app. Stays are DATES (no time of day). */
const MS_DAY = 86_400_000;

export const isDateString = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;

export const parseDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);
export const toDateString = (date: Date): string => date.toISOString().slice(0, 10);
export const addDays = (value: string, days: number): string => toDateString(new Date(parseDate(value).getTime() + days * MS_DAY));
export const nightsBetween = (arrival: string, departure: string): number =>
  Math.round((parseDate(departure).getTime() - parseDate(arrival).getTime()) / MS_DAY);

/** The nights of a stay: arrival night up to, but not including, the departure date. */
export const eachNight = (arrival: string, departure: string): string[] =>
  Array.from({ length: Math.max(nightsBetween(arrival, departure), 0) }, (_, i) => addDays(arrival, i));

/** Friday and Saturday nights use the weekend rate. */
export const isWeekendNight = (date: string): boolean => {
  const day = parseDate(date).getUTCDay();
  return day === 5 || day === 6;
};

/** "Today" as a calendar date in the property's own timezone. */
export const todayIn = (timeZone: string, now: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

export interface RateInput {
  nightlyRateMinor: number;
  weekendRateMinor: number | null;
}

export interface StayQuote {
  nights: number;
  totalMinor: number;
  perNight: Array<{ date: string; rateMinor: number }>;
}

/** All money is whole minor units (centavos). Never floating point. */
export function quoteStay(arrival: string, departure: string, rate: RateInput): StayQuote {
  const perNight = eachNight(arrival, departure).map((date) => ({
    date,
    rateMinor: isWeekendNight(date) && rate.weekendRateMinor !== null ? rate.weekendRateMinor : rate.nightlyRateMinor,
  }));
  return { nights: perNight.length, totalMinor: perNight.reduce((sum, n) => sum + n.rateMinor, 0), perNight };
}

export const formatMoney = (minor: number, currency: string, locale = 'en-PH'): string =>
  new Intl.NumberFormat(locale, { style: 'currency', currency }).format(minor / 100);
