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
import { findMoves, ingest, RULES } from "../lib/invoices/drift.js";
import { toCents } from "../lib/invoices/extract.js";
import * as invoiceFixtures from "../lib/sources/invoices-fixtures.js";
import { plan } from "../lib/forecast/plan.js";
import { STAT_HOLIDAYS, addDays, dow, vancouverToday, longWeekend, paidMinutes, shiftCost, ESA } from "../lib/forecast/bc.js";
import { baselineDates } from "../lib/forecast/demand.js";

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

console.log("\nreconciliation");
const goods = [{ description: "MOZZ SHRD WHL MLK", pack: "5 x 2.5 kg", cases: 4, lineTotalCents: 46200 }];
check("freight and tax do not trigger a false alarm",
  ingest([{ id: "T1", supplier: "T", date: "2026-09-28", lines: goods, subtotalCents: 46200, totalCents: 48050 }])
    .review.filter((r) => r.kind === "does-not-reconcile").length === 0);
check("a subtotal that really disagrees is still caught",
  ingest([{ id: "T2", supplier: "T", date: "2026-09-28", lines: goods, subtotalCents: 50000, totalCents: 52000 }])
    .review.some((r) => r.kind === "does-not-reconcile" && r.basis === "subtotal"));
check("an invoice with no printed subtotal falls back to its total",
  ingest([{ id: "T3", supplier: "T", date: "2026-09-28", lines: goods, totalCents: 50000 }])
    .review.some((r) => r.kind === "does-not-reconcile" && r.basis === "total"));

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

console.log("\nBritish Columbia");
check("eleven statutory holidays in 2026", Object.keys(STAT_HOLIDAYS).length === 11);
const mondays = ["Family Day", "Victoria Day", "B.C. Day", "Labour Day", "Thanksgiving Day"];
check("the Monday holidays all fall on a Monday", Object.entries(STAT_HOLIDAYS).filter(([, n]) => mondays.includes(n)).every(([d]) => dow(d) === 1));
check("Good Friday is a Friday", dow("2026-04-03") === 5);
check("the Friday before Thanksgiving is a long weekend", longWeekend("2026-10-09") === "Thanksgiving Day");
check("so are the Saturday and Sunday", longWeekend("2026-10-10") === "Thanksgiving Day" && longWeekend("2026-10-11") === "Thanksgiving Day");
check("an ordinary Wednesday is not", longWeekend("2026-10-14") === null);
check("Vancouver's date turns at its own midnight, not UTC's",
  vancouverToday(new Date("2026-10-09T06:59:00Z")) === "2026-10-08" && vancouverToday(new Date("2026-10-09T07:01:00Z")) === "2026-10-09");
check("an 8 hour shift pays 7.5, the meal break is off the clock", paidMinutes(0, 480) === 450);
check("a 5 hour shift has no break deducted", paidMinutes(0, 300) === 300);
check("reporting for work pays at least 2 hours", paidMinutes(0, 60) === ESA.minimumPaidMin);
const ord = shiftCost({ startMin: 0, endMin: 480, wageCents: 2000 });
const hol = shiftCost({ startMin: 0, endMin: 480, wageCents: 2000, stat: true });
check("a holiday shift is 1.5 times plus an average day's pay", hol.cents === Math.round(7.5 * 2000 * 1.5) + ord.cents);
check("a salaried manager carries no holiday premium in the rota", shiftCost({ startMin: 0, endMin: 480, wageCents: 3000, stat: true, salaried: true }).statPremiumCents === 0);
check("the baseline skips Labour Day when forecasting a Monday", !baselineDates("2026-09-14").includes("2026-09-07") && baselineDates("2026-09-14").length === 4);

console.log("\nthe Tomorrow plan, over 60 days");
const days = Array.from({ length: 60 }, (_, k) => addDays("2026-10-09", k));
const plans = days.map((d) => plan(d, null));
const everyShift = plans.flatMap((p) => p.sites.flatMap((s) => s.shifts));
const everyChange = plans.flatMap((p) => p.sites.flatMap((s) => s.changes));
check("nobody works two shifts on one day, anywhere in the group", plans.every((p) => {
  const names = p.sites.flatMap((s) => s.shifts.map((x) => x.who));
  return new Set(names).size === names.length;
}));
check("every shift has a real person on it", everyShift.every((x) => typeof x.who === "string" && x.who.length));
check("no shift the planner adds or moves runs into daily overtime", everyShift.filter((x) => x.origin !== "rota").every((x) => x.paidMin <= ESA.dailyOvertimeAfterMin));
const longRota = plans.flatMap((p) => p.sites.flatMap((s) => s.shifts.filter((x) => x.origin === "rota" && x.role !== "manager" && x.paidMin > ESA.dailyOvertimeAfterMin)));
check("any overtime already in the usual rota is reported, not hidden", longRota.length > 0 && plans.every((p) => p.stat || p.sites.every((s) =>
  s.shifts.filter((x) => x.origin === "rota" && x.role !== "manager" && x.paidMin > ESA.dailyOvertimeAfterMin).length === s.rules.length)));
check("an hour past eight costs 1.5 times for staff", shiftCost({ startMin: 0, endMin: 570, wageCents: 2000 }).overtimeCents === 1000);
check("and nothing extra for a manager, who is outside the overtime rules", shiftCost({ startMin: 0, endMin: 570, wageCents: 3000, salaried: true }).overtimeCents === 0);
check("no added or moved shift is shorter than three hours", everyShift.filter((x) => x.origin !== "rota").every((x) => x.end - x.start >= 180));
check("every change carries a reason and a named person", everyChange.every((c) => c.reason?.length > 20 && c.who));
check("no reason uses a question mark", everyChange.every((c) => !c.reason.includes("?")));
check("never more than four changes in a room", plans.every((p) => p.sites.every((s) => s.changes.length <= 4)));
check("the paid hours move by exactly the sum of the changes", plans.every((p) => p.sites.every((s) =>
  s.proposed.paidMin - s.usual.paidMin === s.changes.reduce((a, c) => a + c.deltaMin, 0))));
check("and the wage bill moves by exactly the sum of the changes, to the cent", plans.every((p) => p.sites.every((s) =>
  s.proposed.cents - s.usual.cents === s.changes.reduce((a, c) => a + c.deltaCents, 0))));
check("the chart's proposed line is the usual line plus every change", plans.every((p) => p.sites.every((s) =>
  s.chart.every((pt) => Math.abs(pt.before + s.changes.flatMap((c) => c.cap).filter((w) => w.from <= pt.t && pt.t < w.to).reduce((a, w) => a + w.d, 0) - pt.after) < 1e-6))));
check("it proposes changes on most days, not none and not noise", plans.filter((p) => p.totals.changes > 0).length >= 45);
check("the same day plans the same way twice", JSON.stringify(plan("2026-10-09", null)) === JSON.stringify(plan("2026-10-09", null)));
const wet = plan("2026-10-09", { code: 63, tempMaxC: 12, precipitationMm: 9, precipitationChance: 90 });
const dry = plan("2026-10-09", { code: 0, tempMaxC: 15, precipitationMm: 0, precipitationChance: 0 });
check("rain lowers the waterfront room and lifts the mall", wet.sites[0].forecast.orders < dry.sites[0].forecast.orders && wet.sites[2].forecast.orders > dry.sites[2].forecast.orders);
check("Thanksgiving carries a holiday premium, an ordinary Tuesday none",
  plan("2026-10-12", null).totals.statPremiumCents > 0 && plan("2026-10-13", null).totals.statPremiumCents === 0);

console.log(failed ? `\n${failed} failure(s)` : "\nall passed");
process.exit(failed ? 1 : 0);
