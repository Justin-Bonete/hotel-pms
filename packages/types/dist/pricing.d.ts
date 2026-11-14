export declare const isDateString: (value: string) => boolean;
export declare const parseDate: (value: string) => Date;
export declare const toDateString: (date: Date) => string;
export declare const addDays: (value: string, days: number) => string;
export declare const nightsBetween: (arrival: string, departure: string) => number;
/** The nights of a stay: arrival night up to, but not including, the departure date. */
export declare const eachNight: (arrival: string, departure: string) => string[];
/** Friday and Saturday nights use the weekend rate. */
export declare const isWeekendNight: (date: string) => boolean;
/** "Today" as a calendar date in the property's own timezone. */
export declare const todayIn: (timeZone: string, now?: Date) => string;
export interface RateInput {
    nightlyRateMinor: number;
    weekendRateMinor: number | null;
}
export interface StayQuote {
    nights: number;
    totalMinor: number;
    perNight: Array<{
        date: string;
        rateMinor: number;
    }>;
}
/** All money is whole minor units (centavos). Never floating point. */
export declare function quoteStay(arrival: string, departure: string, rate: RateInput): StayQuote;
export declare const formatMoney: (minor: number, currency: string, locale?: string) => string;
