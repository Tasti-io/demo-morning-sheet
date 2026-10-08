/**
 * How Harbour & Co is usually staffed, and what it pays.
 *
 * Moved here from demo-tips on 8 Oct 2026, because a second demo now reads it: the
 * morning sheet's Tomorrow tab proposes changes to this rota. Two copies of one rota
 * would drift, and a visitor who opens both demos would then see two different
 * Fridays at the same restaurant. demo-tips still carries its own copy in
 * lib/fixtures.js; point it here the next time that file is touched.
 *
 * Times are minutes after midnight, local time in Vancouver.
 */
export const hm = (h, m = 0) => h * 60 + m;

/** Opening hours by JavaScript weekday, 0 = Sunday. Same for every room, as on the Avo venue page. */
export const OPEN_BY_DOW = [
  [hm(8), hm(16)], // Sunday
  [hm(7), hm(17)], // Monday
  [hm(7), hm(17)], // Tuesday
  [hm(7), hm(17)], // Wednesday
  [hm(7), hm(17)], // Thursday
  [hm(7), hm(21)], // Friday
  [hm(8), hm(21)], // Saturday
];

/** Which rota a weekday runs. Monday to Thursday share one. */
export const dayKind = (dow) => (dow === 5 ? "fri" : dow === 6 ? "sat" : dow === 0 ? "sun" : "wk");

/**
 * The rota a manager copies forward week after week: [role, start, end, count] per
 * site and day kind. Verbatim from demo-tips, so the people on Friday in the tips
 * demo are the people the Tomorrow tab is proposing to move.
 */
export const ROTA = {
  harbour: {
    wk: [["manager", hm(9), hm(17, 30), 1], ["server", hm(6, 30), hm(14, 30), 2], ["host", hm(6, 45), hm(14, 30), 1], ["runner", hm(7), hm(14), 1], ["sous-chef", hm(6), hm(14, 30), 1], ["cook", hm(6, 30), hm(14, 30), 1], ["prep", hm(6), hm(13), 1], ["dish", hm(7), hm(15), 1],
         ["server", hm(11), hm(17, 30), 2], ["bartender", hm(12), hm(17, 30), 1], ["runner", hm(11, 30), hm(17, 30), 1], ["cook", hm(11), hm(17, 30), 1], ["dish", hm(12), hm(17, 30), 1]],
    fri: [["manager", hm(12), hm(21, 30), 1], ["server", hm(6, 30), hm(14, 30), 2], ["host", hm(6, 45), hm(14, 30), 1], ["runner", hm(7), hm(14), 1], ["sous-chef", hm(6), hm(14, 30), 1], ["cook", hm(6, 30), hm(14, 30), 1], ["prep", hm(6), hm(13), 1], ["dish", hm(7), hm(15), 1],
          ["server", hm(14), hm(21, 30), 4], ["bartender", hm(14), hm(21, 30), 2], ["host", hm(14), hm(21), 1], ["runner", hm(14), hm(21, 30), 2], ["cook", hm(13, 30), hm(21, 30), 2], ["dish", hm(14), hm(22), 1]],
    sat: [["manager", hm(12), hm(21, 30), 1], ["server", hm(7, 30), hm(14, 30), 2], ["host", hm(7, 45), hm(14, 30), 1], ["runner", hm(8), hm(14, 30), 1], ["sous-chef", hm(7), hm(14, 30), 1], ["cook", hm(7, 30), hm(14, 30), 1], ["prep", hm(7), hm(13), 1], ["dish", hm(8), hm(15), 1],
          ["server", hm(14), hm(21, 30), 4], ["bartender", hm(14), hm(21, 30), 1], ["host", hm(14), hm(21), 1], ["runner", hm(14), hm(21, 30), 2], ["cook", hm(13, 30), hm(21, 30), 2], ["dish", hm(14), hm(22), 1]],
    sun: [["server", hm(7, 30), hm(14, 30), 3], ["host", hm(7, 45), hm(14, 30), 1], ["runner", hm(8), hm(14, 30), 1], ["sous-chef", hm(7), hm(14, 30), 1], ["cook", hm(7, 30), hm(14, 30), 1], ["dish", hm(8), hm(15), 1],
          ["server", hm(12), hm(16, 30), 2], ["bartender", hm(12), hm(16, 30), 1], ["cook", hm(12), hm(16, 30), 1], ["dish", hm(12), hm(16, 30), 1]],
  },
  lonsdale: {
    wk: [["manager", hm(9), hm(17, 30), 1], ["barista", hm(6, 30), hm(13), 2], ["cook", hm(6, 30), hm(14), 1], ["barista", hm(11), hm(17, 30), 1], ["server", hm(11), hm(17, 30), 1], ["dish", hm(10), hm(17, 30), 1]],
    fri: [["manager", hm(12), hm(21, 30), 1], ["barista", hm(6, 30), hm(13), 2], ["cook", hm(6, 30), hm(14), 1], ["barista", hm(13), hm(21, 30), 1], ["server", hm(14), hm(21, 30), 1], ["cook", hm(14), hm(21, 30), 1], ["dish", hm(14), hm(21, 30), 1]],
    sat: [["manager", hm(12), hm(21, 30), 1], ["barista", hm(7, 30), hm(14), 2], ["server", hm(8), hm(14), 1], ["cook", hm(7, 30), hm(14), 1], ["barista", hm(13, 30), hm(21, 30), 1], ["server", hm(14), hm(21, 30), 1], ["cook", hm(14), hm(21, 30), 1], ["dish", hm(12), hm(21, 30), 1]],
    sun: [["barista", hm(7, 30), hm(14), 2], ["cook", hm(7, 30), hm(14, 30), 1], ["barista", hm(12), hm(16, 30), 1], ["dish", hm(10), hm(16, 30), 1]],
  },
  oakridge: {
    wk: [["barista", hm(6, 30), hm(13), 2], ["cook", hm(7), hm(14), 1], ["barista", hm(12), hm(17, 30), 1]],
    fri: [["barista", hm(6, 30), hm(13), 2], ["cook", hm(7), hm(14), 1], ["barista", hm(13), hm(21, 30), 2]],
    sat: [["barista", hm(7, 30), hm(14), 2], ["barista", hm(13, 30), hm(21, 30), 2]],
    sun: [["barista", hm(7, 30), hm(14), 2], ["barista", hm(12), hm(16, 30), 1]],
  },
  langley: {
    wk: [["manager", hm(9), hm(17, 30), 1], ["server", hm(6, 30), hm(14, 30), 1], ["cook", hm(6, 30), hm(14, 30), 1], ["dish", hm(8), hm(15), 1], ["server", hm(11), hm(17, 30), 1], ["cook", hm(11), hm(17, 30), 1]],
    fri: [["manager", hm(12), hm(21, 30), 1], ["server", hm(6, 30), hm(14, 30), 1], ["cook", hm(6, 30), hm(14, 30), 1], ["dish", hm(8), hm(15), 1], ["server", hm(14), hm(21, 30), 3], ["bartender", hm(14), hm(21, 30), 1], ["host", hm(14), hm(21), 1], ["cook", hm(13, 30), hm(21, 30), 2], ["dish", hm(14), hm(22), 1]],
    sat: [["manager", hm(12), hm(21, 30), 1], ["server", hm(7, 30), hm(14, 30), 2], ["host", hm(7, 45), hm(14, 30), 1], ["cook", hm(7, 30), hm(14, 30), 1], ["dish", hm(8), hm(15), 1], ["server", hm(14), hm(21, 30), 3], ["bartender", hm(14), hm(21, 30), 1], ["cook", hm(13, 30), hm(21, 30), 2], ["dish", hm(14), hm(22), 1]],
    sun: [["server", hm(7, 30), hm(14, 30), 2], ["host", hm(7, 45), hm(14, 30), 1], ["cook", hm(7, 30), hm(14, 30), 2], ["dish", hm(8), hm(15), 1], ["server", hm(12), hm(16, 30), 1], ["cook", hm(12), hm(16, 30), 1]],
  },
};

/**
 * Hourly wages in cents. Invented, and deliberately above the BC general minimum
 * wage of $18.25 that took effect on 1 June 2026, so no demo ever shows a rate that
 * would be illegal to pay. Servers, hosts and runners sit nearest the floor because
 * they share in the tip pool. The managers are salaried; their figure is the hourly
 * equivalent, used only to cost a day.
 */
export const WAGES = {
  server: 1900, host: 1900, runner: 1900,
  barista: 1925, bartender: 1950,
  dish: 1975, prep: 2050, cook: 2250, "sous-chef": 2600,
  manager: 3000,
};
