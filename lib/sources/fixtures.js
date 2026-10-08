/**
 * The no-credentials source.
 *
 * A public demo that depends on a live third-party API is a demo that will one day
 * be broken in front of a prospect, usually the one who mattered. These numbers are
 * invented but internally consistent: ticket sizes match the format, labour tracks
 * hours at plausible BC wages, and the exceptions the sheet flags are real
 * consequences of the data rather than hardcoded badges.
 *
 * The group is fictional on purpose. Using a real operator's name on a public page
 * would be putting words in their mouth.
 */

import { OPEN_BY_DOW } from "../harbour/index.js";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// A deterministic generator: the demo must look the same to the prospect as it did
// to us, and must not change between a page load and a screenshot in an email.
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/**
 * Exported because the Tomorrow tab forecasts from the same base orders and ticket
 * sizes, so the two halves of the page describe one business. `harbourId` joins a
 * site to the shared Harbour & Co dataset (lib/harbour), where the staff and rota live.
 */
export const SITES = [
  { id: "L-HARBOUR", harbourId: "harbour", name: "Harbour Street", format: "Flagship room, 92 seats", baseOrders: 412, ticket: 2180, labourRate: 0.281 },
  { id: "L-LONSDALE", harbourId: "lonsdale", name: "Lonsdale", format: "Neighbourhood cafe, 40 seats", baseOrders: 268, ticket: 1640, labourRate: 0.302 },
  { id: "L-OAKRIDGE", harbourId: "oakridge", name: "Oakridge food hall", format: "Counter, no seating", baseOrders: 331, ticket: 1190, labourRate: 0.258 },
  { id: "L-LANGLEY", harbourId: "langley", name: "Langley", format: "Suburban room, 70 seats", baseOrders: 197, ticket: 2040, labourRate: 0.349 },
];

export function load({ date = new Date() } = {}) {
  const day = new Date(date);
  day.setDate(day.getDate() - 1); // the sheet always reports yesterday
  const weekday = WEEKDAYS[day.getDay()];
  const rnd = seeded(day.getFullYear() * 10000 + (day.getMonth() + 1) * 100 + day.getDate());

  const sites = SITES.map((site, i) => {
    const swing = 0.78 + rnd() * 0.46;
    const orders = Math.round(site.baseOrders * swing);
    const netSales = Math.round(orders * site.ticket * (0.94 + rnd() * 0.12));
    const medianSales = Math.round(site.baseOrders * site.ticket);
    const labourCost = Math.round(netSales * (site.labourRate + (rnd() - 0.5) * 0.06));
    const voids = Math.round(rnd() * 5);

    return {
      ...site,
      weekday,
      orders,
      netSales,
      medianSales,
      labourCost,
      labourPct: (labourCost / netSales) * 100,
      voids,
      // One site in the set closes early, because a real morning sheet always has
      // one oddity and a demo where everything is fine teaches the viewer nothing.
      closedEarly: i === 3 && rnd() > 0.45,
    };
  });

  // The last sale sits a few minutes before that weekday's closing time, the same
  // hours the Tomorrow tab and the Avo venue page show. These used to be fixed
  // evening times, which put a 21:51 sale on a Wednesday when the rooms close at 17:00.
  const close = OPEN_BY_DOW[day.getDay()][1];
  for (const [i, s] of sites.entries()) {
    s.lastSale = hhmm(close - (s.closedEarly ? 78 : [9, 48, 2, 13][i]));
  }

  return {
    sites,
    meta: {
      source: "fixtures",
      sourceLabel: "Sample data",
      group: "Harbour & Co",
      forDate: day.toISOString().slice(0, 10),
      weekday,
      generatedAt: new Date().toISOString(),
    },
  };
}
