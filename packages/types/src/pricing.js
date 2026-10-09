"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatMoney = exports.todayIn = exports.isWeekendNight = exports.eachNight = exports.nightsBetween = exports.addDays = exports.toDateString = exports.parseDate = exports.isDateString = void 0;
exports.quoteStay = quoteStay;
/** Pure date and money helpers shared by the API and the web app. Stays are DATES (no time of day). */
const MS_DAY = 86_400_000;
const isDateString = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
exports.isDateString = isDateString;
const parseDate = (value) => new Date(`${value}T00:00:00.000Z`);
exports.parseDate = parseDate;
const toDateString = (date) => date.toISOString().slice(0, 10);
exports.toDateString = toDateString;
const addDays = (value, days) => (0, exports.toDateString)(new Date((0, exports.parseDate)(value).getTime() + days * MS_DAY));
exports.addDays = addDays;
const nightsBetween = (arrival, departure) => Math.round(((0, exports.parseDate)(departure).getTime() - (0, exports.parseDate)(arrival).getTime()) / MS_DAY);
exports.nightsBetween = nightsBetween;
/** The nights of a stay: arrival night up to, but not including, the departure date. */
const eachNight = (arrival, departure) => Array.from({ length: Math.max((0, exports.nightsBetween)(arrival, departure), 0) }, (_, i) => (0, exports.addDays)(arrival, i));
exports.eachNight = eachNight;
/** Friday and Saturday nights use the weekend rate. */
const isWeekendNight = (date) => {
    const day = (0, exports.parseDate)(date).getUTCDay();
    return day === 5 || day === 6;
};
exports.isWeekendNight = isWeekendNight;
/** "Today" as a calendar date in the property's own timezone. */
const todayIn = (timeZone, now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
exports.todayIn = todayIn;
/** All money is whole minor units (centavos). Never floating point. */
function quoteStay(arrival, departure, rate) {
    const perNight = (0, exports.eachNight)(arrival, departure).map((date) => ({
        date,
        rateMinor: (0, exports.isWeekendNight)(date) && rate.weekendRateMinor !== null ? rate.weekendRateMinor : rate.nightlyRateMinor,
    }));
    return { nights: perNight.length, totalMinor: perNight.reduce((sum, n) => sum + n.rateMinor, 0), perNight };
}
const formatMoney = (minor, currency, locale = 'en-PH') => new Intl.NumberFormat(locale, { style: 'currency', currency }).format(minor / 100);
exports.formatMoney = formatMoney;
