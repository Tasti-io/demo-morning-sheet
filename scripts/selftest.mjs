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

console.log(failed ? `\n${failed} failure(s)` : "\nall passed");
process.exit(failed ? 1 : 0);
