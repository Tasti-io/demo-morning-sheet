/**
 * Sixteen weeks of supplier invoices for the same fictional group.
 *
 * Invented, deterministic, and deliberately awkward. A fixture set where every
 * line parses and every item trends cleanly proves nothing: the real question a
 * prospect has is what happens to the line nobody can read, and a demo that never
 * shows one is a demo that is hiding it.
 *
 * So this set contains, on purpose: a steady rise worth real money, the same cut
 * of chicken bought from two suppliers at two prices in the same month, a price
 * that fell, an item that swings 25% week to week and means nothing by it, a 35%
 * rise on something too small to be worth a sentence, an unreadable pack size, an
 * item no catalog entry matches, and one invoice whose lines do not add up to its
 * own total. All eight are checked by the self-test.
 *
 * The supplier names are invented. Putting a real distributor's name next to
 * invented prices on a public page would be making a claim about their business.
 */
import { parsePack, packBaseQuantity } from "../invoices/units.js";

const DAY = 86_400_000;
const iso = (d) => d.toISOString().slice(0, 10);

/**
 * Cents per base unit, as a function of how many weeks ago the delivery was.
 *
 * Each has a deliberate shape plus a small deterministic wobble, because a real
 * price series steps and backtracks. A trend drawn with a ruler would make the
 * comparison look easier than it is: the whole reason findings are built from a
 * volume-weighted window rather than from the last invoice is that weeks like
 * these do not sit on a line.
 */
const wobble = (w, scale) => 1 + scale * Math.sin(w * 2.3) + (scale / 2) * Math.cos(w * 5.1);

const PRICE = {
  mozzarella: (w) => (945 - 155 * (w / 16)) * wobble(w, 0.018),   // the steady creep: $7.90/kg -> $9.45/kg
  "chicken-pacific": (w) => 1340 * wobble(w, 0.008),               // same cut, two suppliers, two prices
  "chicken-fraser": (w) => 1150 * wobble(w, 0.008),
  "coffee-beans": (w) => 2850 * wobble(w, 0.006),
  "oat-milk": (w) => (282 + 48 * (w / 16)) * wobble(w, 0.015),     // fell from $3.30/L to $2.82/L
  avocado: (w) => 100 + 25 * Math.sin(w * 1.7),                    // noisy, trendless: must stay quiet
  napkins: (w) => 2.7 - 0.7 * (w / 16),                            // +35%, and far too small to mention
  flour: (w) => 190 * wobble(w, 0.01),
};

function line(description, pack, cases, unitCents) {
  const per = packBaseQuantity(parsePack(pack));
  const quantity = per ? per.quantity * cases : 0;
  return { description, pack, cases, lineTotalCents: Math.round(unitCents * quantity) };
}

const total = (lines) => lines.reduce((a, l) => a + l.lineTotalCents, 0);

export function load({ asOf = new Date(), weeks = 16 } = {}) {
  const invoices = [];

  for (let w = weeks; w >= 0; w -= 1) {
    const date = iso(new Date(asOf.getTime() - (w * 7 + 2) * DAY));
    const seq = String(1000 + (weeks - w));

    // Broadline distributor: cheese, flour, produce, and chicken every other week.
    const pacific = [
      line("MOZZ SHRD WHL MLK 5/2.5KG", "5 x 2.5 kg", 4, PRICE.mozzarella(w)),
      line("FLOUR BREAD RED SPRING 20KG", "20 kg", 2, PRICE.flour(w)),
      // Week 2's produce line arrived with a pack description nobody can parse.
      w === 2
        ? line("AVOCADO HASS 48CT", "banana box", 3, PRICE.avocado(w))
        : line("AVOCADO HASS 48CT", "48 ct", 3, PRICE.avocado(w)),
    ];
    if (w % 2 === 0) pacific.push(line("CHKN THGH BNLS SKNLS 4KG", "4 kg", 10, PRICE["chicken-pacific"](w)));
    // Week 1 carried something the catalog has never seen.
    if (w === 1) pacific.push(line("CROISSANT BUTTER PREPROOF 48CT", "48 ct", 2, 95));
    invoices.push({ id: `PF-${seq}`, supplier: "Pacific Foodservice", date, lines: pacific, totalCents: total(pacific) });

    if (w % 2 === 1) {
      const lines = [line("Chicken Bnls Thigh, fresh", "4 kg", 10, PRICE["chicken-fraser"](w))];
      invoices.push({ id: `FVM-${seq}`, supplier: "Fraser Valley Meats", date, lines, totalCents: total(lines) });
    }

    const roaster = [
      line("ESPRESSO BEAN HOUSE 5KG", "5 kg", 3, PRICE["coffee-beans"](w)),
      line("OAT BEV BARISTA 12X1L", "12x1L", 12, PRICE["oat-milk"](w)),
    ];
    invoices.push({
      id: `HCR-${seq}`, supplier: "Harbour Coffee Roasters", date, lines: roaster,
      // Week 3's invoice states a total $12 above its own lines. Somebody keyed it wrong.
      totalCents: total(roaster) + (w === 3 ? 1200 : 0),
    });

    const paper = [line("NAPKIN DISPENSER 1PLY 500CT", "500 ct", 1, PRICE.napkins(w))];
    invoices.push({ id: `LMP-${seq}`, supplier: "Lower Mainland Paper", date, lines: paper, totalCents: total(paper) });
  }

  return {
    invoices,
    meta: {
      source: "fixtures",
      sourceLabel: "Sample invoices",
      group: "Harbour & Co",
      inboxLabel: "invoices@harbourandco.example",
      asOf: iso(asOf),
    },
  };
}
