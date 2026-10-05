#!/usr/bin/env node
/**
 * Self-test for the demo's logic.
 *
 * The exception rules are the only real thinking in this project, so they are the
 * only thing worth testing. A demo that flags the wrong site is worse than no demo:
 * the prospect's whole impression is "this person's numbers cannot be trusted".
 */
import { buildSheet, exceptions } from "../lib/shape.js";
import * as fixtures from "../lib/sources/fixtures.js";
import { parsePack, unitCost, UnitError } from "../lib/invoices/units.js";
import { matchItem } from "../lib/invoices/catalog.js";
import { findMoves, RULES } from "../lib/invoices/drift.js";
import { toCents } from "../lib/invoices/extract.js";
import * as invoiceFixtures from "../lib/sources/invoices-fixtures.js";

let failed = 0;
const check = (name, cond) => {
  if (cond) console.log(`  ok   ${name}`);
  else {
    console.error(`  FAIL ${name}`);
    failed += 1;
  }
};

const base = {
  name: "Test", weekday: "Tuesday", orders: 300, netSales: 600000,
  medianSales: 600000, labourCost: 150000, labourPct: 25, voids: 1, closedEarly: false,
};

console.log("exception rules");
check("a site on its own median is not flagged", exceptions(base).length === 0);
check("20% below its own median is flagged down",
  exceptions({ ...base, netSales: 480000 }).some((e) => e.level === "down"));
check("25% above its own median is flagged up",
  exceptions({ ...base, netSales: 750000 }).some((e) => e.level === "up"));
check("a 10% dip is noise, not a flag",
  exceptions({ ...base, netSales: 540000 }).length === 0);
check("labour at 36% is flagged",
  exceptions({ ...base, labourPct: 36 }).some((e) => e.text.includes("labour")));
check("labour at 30% is not",
  !exceptions({ ...base, labourPct: 30 }).some((e) => e.text.includes("labour")));
check("4 voids on 300 orders stays quiet",
  !exceptions({ ...base, voids: 4 }).some((e) => e.text.includes("voids")));
check("4 voids on 40 orders is flagged",
  exceptions({ ...base, voids: 4, orders: 40 }).some((e) => e.text.includes("voids")));
check("closing early is flagged",
  exceptions({ ...base, closedEarly: true }).some((e) => e.text.includes("closing")));

console.log("\nsheet assembly");
const { sites, meta } = fixtures.load({ date: new Date("2026-10-07T09:00:00Z") });
const sheet = buildSheet(sites, meta);
check("four sites", sheet.sites.length === 4);
check("totals add up",
  sheet.totals.netSales === sheet.sites.reduce((a, s) => a + s.netSales, 0));
check("average ticket is sales over orders",
  Math.round(sheet.totals.avgTicket) === Math.round(sheet.totals.netSales / sheet.totals.orders));
check("needsAttention only lists sites with a down flag",
  sheet.needsAttention.every((n) =>
    sheet.sites.find((s) => s.name === n).exceptions.some((e) => e.level === "down")));
check("no site reports a labour share above 100%",
  sheet.sites.every((s) => s.labourPct < 100));

console.log("\ndeterminism");
const a = JSON.stringify(fixtures.load({ date: new Date("2026-10-07T09:00:00Z") }).sites);
const b = JSON.stringify(fixtures.load({ date: new Date("2026-10-07T23:00:00Z") }).sites);
check("same day gives identical numbers", a === b);
const c = JSON.stringify(fixtures.load({ date: new Date("2026-10-08T09:00:00Z") }).sites);
check("a different day gives different numbers", a !== c);

console.log("\nunit normalization");
check("a 25 lb case at $90 prices at $7.94/kg",
  Math.abs(unitCost({ cases: 1, pack: "25 lb", lineTotalCents: 9000 }).unitCostCents - 793.66) < 0.5);
check("5 x 2.5 kg is read as 12.5 kg a case",
  unitCost({ cases: 1, pack: "5 x 2.5 kg", lineTotalCents: 10000 }).baseQuantity === 12.5);
check("pounds and kilograms land on the same number",
  Math.abs(unitCost({ cases: 1, pack: "25 lb", lineTotalCents: 9000 }).unitCostCents
         - unitCost({ cases: 1, pack: "11.33980925 kg", lineTotalCents: 9000 }).unitCostCents) < 0.01);
check("an unreadable pack throws instead of guessing", (() => {
  try { unitCost({ cases: 1, pack: "banana box", lineTotalCents: 9000 }); return false; }
  catch (e) { return e instanceof UnitError; }
})());
check("a pack we cannot parse returns null", parsePack("banana box") === null);

console.log("\ncatalog matching");
check("two suppliers' wording joins to one item",
  matchItem("MOZZ SHRD WHL MLK 5/2.5KG") === matchItem("Cheese Mozzarella Shredded 25LB"));
check("an item nobody registered stays unmatched",
  matchItem("CROISSANT BUTTER PREPROOF 48CT") === null);

console.log("\nprinted money");
check("thousands separators survive", toCents("1,284.55") === 128455);
check("a bracketed credit is negative", toCents("(3.50)") === -350);

console.log("\ncost findings");
const asOf = new Date("2026-10-05T09:00:00Z");
const { invoices } = invoiceFixtures.load({ asOf });
const moves = findMoves(invoices, { asOf });
const kindOf = (id) => moves.findings.filter((f) => f.itemId === id).map((f) => f.kind);

check("the steady riser is reported as a creep", kindOf("mozzarella").includes("creep"));
check("the riser carries its stale menu price",
  moves.findings.find((f) => f.itemId === "mozzarella" && f.kind === "creep")?.menu?.item === "Margherita");
check("the same cut at two suppliers is reported as a spread", kindOf("chicken-thigh").includes("spread"));
check("the faller is reported, not hidden", kindOf("oat-milk").includes("relief"));
check("a noisy, trendless item stays quiet", kindOf("avocado").length === 0);
check("a 35% rise on a tiny spend stays quiet", kindOf("napkins").length === 0);
check("a flat item stays quiet", kindOf("flour").length === 0);
check("nothing below the dollar floor is reported",
  moves.findings.every((f) => Math.abs(f.monthlyImpactCents) >= RULES.minMonthlyImpactCents));
check("every finding points at a real invoice",
  moves.findings.every((f) => f.kind === "spread" || (f.evidence?.from?.invoice && f.evidence?.to?.invoice)));

console.log("\nwhat gets held back");
const kinds = new Set(moves.review.map((r) => r.kind));
check("an unmatched description goes to review", kinds.has("unmatched"));
check("an unreadable pack goes to review", kinds.has("unreadable-pack"));
check("an invoice that does not add up goes to review", kinds.has("does-not-reconcile"));
check("held-back lines are not priced into the findings",
  moves.findings.every((f) => f.itemId !== "croissant"));

console.log("\ninvoice determinism");
check("the same day reads the same both times",
  JSON.stringify(findMoves(invoiceFixtures.load({ asOf }).invoices, { asOf }).findings)
  === JSON.stringify(moves.findings));

console.log(failed ? `\n${failed} failure(s)` : "\nall passed");
process.exit(failed ? 1 : 0);
