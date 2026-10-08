/**
 * British Columbia: the calendar and the parts of the Employment Standards Act a
 * rota has to respect. Kept in one file because these are the facts most likely to
 * be wrong, and a demo that misstates the law is worse than one that says nothing.
 *
 * Checked against the Act on bclaws.gov.bc.ca and the statutory holiday page on
 * gov.bc.ca on 8 Oct 2026. Where this file simplifies, it says so, and the page
 * repeats the simplification to the reader.
 *
 * This is the half of the product Meuze does not have: their supplier is Sysco and
 * their calendar is American. A Canadian group needs Canadian holidays and BC pay.
 */

/** The eleven BC statutory holidays for 2026 (gov.bc.ca, statutory holidays page). */
export const STAT_HOLIDAYS = {
  "2026-01-01": "New Year's Day",
  "2026-02-16": "Family Day",
  "2026-04-03": "Good Friday",
  "2026-05-18": "Victoria Day",
  "2026-07-01": "Canada Day",
  "2026-08-03": "B.C. Day",
  "2026-09-07": "Labour Day",
  "2026-09-30": "National Day for Truth and Reconciliation",
  "2026-10-12": "Thanksgiving Day",
  "2026-11-11": "Remembrance Day",
  "2026-12-25": "Christmas Day",
};

export const statHoliday = (iso) => STAT_HOLIDAYS[iso] ?? null;

/** How people say it: "the Thanksgiving long weekend", not "the Thanksgiving Day long weekend". */
const SHORT = { "Thanksgiving Day": "Thanksgiving", "New Year's Day": "New Year's", "National Day for Truth and Reconciliation": "Truth and Reconciliation" };
export const shortName = (name) => SHORT[name] ?? name;

/** Plain date arithmetic on YYYY-MM-DD, in UTC so a server in any zone agrees. */
export function addDays(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
export const dow = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay();

/**
 * Today's date in Vancouver, whatever zone the server runs in. Built from parts
 * rather than from a locale's formatted string, because how "en-CA" prints a date
 * differs between Node builds, and a page that silently plans the wrong day would be
 * worse than one that fails.
 */
export function vancouverToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Vancouver", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Is this day part of a long weekend, and whose? True on the Friday, Saturday and
 * Sunday before a Monday holiday, and on the eve of a midweek one. Those are the
 * days a suburban room empties and a downtown one fills, so they get their own
 * adjustment. The holiday itself is handled separately, because it is also a pay day.
 */
export function longWeekend(iso) {
  const d = dow(iso);
  const toMonday = { 5: 3, 6: 2, 0: 1 }[d];
  if (toMonday) {
    const monday = statHoliday(addDays(iso, toMonday));
    if (monday) return monday;
  }
  return statHoliday(addDays(iso, 1));
}

/** The sections of the Employment Standards Act this planner applies, with their numbers. */
export const ESA = {
  /** s.32: no more than 5 consecutive hours without a meal break of at least half an hour. */
  mealBreakAfterMin: 5 * 60,
  mealBreakMin: 30,
  /** s.34: an employee who reports for work is paid for at least 2 hours. */
  minimumPaidMin: 2 * 60,
  /**
   * s.40(1): over 8 hours in a day is paid at 1.5 times. The planner never proposes a
   * shift past it, and costs any that the usual rota already has at the overtime rate.
   * Managers are outside Part 4 entirely (Employment Standards Regulation s.34(f)),
   * so a manager's long day is legal and costs no premium.
   */
  dailyOvertimeAfterMin: 8 * 60,
  overtimeMultiplier: 1.5,
  /** s.46: work on a statutory holiday is paid at 1.5 times, plus an average day's pay. */
  statMultiplier: 1.5,
};

/**
 * Paid minutes for a shift. The meal break is treated as unpaid, which is the usual
 * case and correct only when the employee is free to leave; s.32 makes it paid if
 * they are required to be available. Stated on the page.
 */
export function paidMinutes(startMin, endMin) {
  const length = endMin - startMin;
  const paid = length > ESA.mealBreakAfterMin ? length - ESA.mealBreakMin : length;
  return Math.max(paid, ESA.minimumPaidMin);
}

/**
 * What a shift costs, in cents.
 *
 * On an ordinary day, paid time past 8 hours costs 1.5 times (s.40), unless the
 * person is a manager (Regulation s.34(f)).
 *
 * On a statutory holiday, s.46 pays an eligible employee 1.5 times for the hours
 * worked (up to 12, and no shift here is longer) AND an average day's pay on top.
 * The average day's pay is defined by a formula over the previous 30 days (s.45);
 * this planner estimates it as one ordinary shift of the same length, and says so.
 * Eligibility (s.44: employed 30 calendar days and worked or earned wages on 15 of
 * the 30 before the holiday) is assumed for every hourly employee. Salaried managers
 * are costed at their daily rate only; their holiday entitlement is a payroll
 * matter, not a rota one.
 */
export function shiftCost({ startMin, endMin, wageCents, salaried = false, stat = false }) {
  const paid = paidMinutes(startMin, endMin);
  const hours = paid / 60;
  const ordinary = Math.round(hours * wageCents);
  if (salaried) return { cents: ordinary, ordinaryCents: ordinary, statPremiumCents: 0, overtimeCents: 0, hours };
  if (stat) {
    const worked = Math.round(hours * wageCents * ESA.statMultiplier);
    const averageDay = ordinary; // estimate, see above
    return { cents: worked + averageDay, ordinaryCents: ordinary, statPremiumCents: worked + averageDay - ordinary, overtimeCents: 0, hours };
  }
  const overMin = Math.max(0, paid - ESA.dailyOvertimeAfterMin);
  const overtime = Math.round((overMin / 60) * wageCents * (ESA.overtimeMultiplier - 1));
  return { cents: ordinary + overtime, ordinaryCents: ordinary, statPremiumCents: 0, overtimeCents: overtime, hours };
}
