/**
 * What the invoices say happened to your costs.
 *
 * Every number in here is computed in plain arithmetic. No model is consulted,
 * because the moment a model produces the dollar figure, the figure has to be
 * checked by hand, and a finding that has to be checked by hand has saved nobody
 * any time. The model's job is upstream: turning a PDF into line items. From that
 * point on this file is ordinary, auditable code.
 *
 * Two rules shape all of it.
 *
 * Compare like with like. A price is compared against the same item's own
 * volume-weighted average from six to sixteen weeks ago, never against the last
 * invoice. Single invoices swing for reasons that are not price: a short order, a
 * substitution, a delivery that straddled a weekend.
 *
 * Say nothing unless it is worth money. A 30% rise on an item you spend $40 a
 * month on is arithmetically true and operationally useless. Every finding has to
 * clear a dollar floor, or the page becomes noise and stops being read, which is
 * exactly how the POS dashboards they already ignore got that way.
 */
import { unitCost, UnitError, BASE_LABEL } from "./units.js";
import { matchItem, item as catalogItem } from "./catalog.js";

const DAY = 86_400_000;

/** Tunables, in one place, so the thresholds are arguable instead of buried. */
export const RULES = {
  recentDays: 28,
  baselineStartDaysAgo: 112,
  baselineEndDaysAgo: 42,
  minRecentObservations: 3,
  minBaselineObservations: 2,
  creepPct: 0.06,
  reliefPct: 0.08,
  supplierSpreadPct: 0.12,
  minMonthlyImpactCents: 15_000, // $150/month: below this, nobody should be reading a sentence about it
};

const vwap = (obs) => {
  const qty = obs.reduce((a, o) => a + o.baseQuantity, 0);
  if (!qty) return null;
  return obs.reduce((a, o) => a + o.unitCostCents * o.baseQuantity, 0) / qty;
};

/**
 * Turn invoices into priced observations, and put everything doubtful into a
 * review queue instead of into the numbers.
 *
 * Three things get pulled out rather than swallowed: a description that matches no
 * catalog item, a pack size we cannot parse, and an invoice whose lines do not add
 * up to its own stated total. The last one is the cheapest fraud-and-typo check
 * there is, and it is the one that catches a misread digit before it becomes a
 * confident claim about somebody's cheese.
 */
export function ingest(invoices) {
  const observations = [];
  const review = [];

  for (const inv of invoices) {
    let lineSum = 0;

    for (const line of inv.lines) {
      lineSum += line.lineTotalCents;
      const itemId = line.itemId ?? matchItem(line.description, line.code);

      if (!itemId) {
        review.push({ kind: "unmatched", invoice: inv.id, supplier: inv.supplier, code: line.code ?? null, description: line.description });
        continue;
      }

      // Retail and cash-and-carry receipts print a price and no pack size. Where a
      // person has recorded the pack for that item, use it and say so; where
      // nobody has, the line is held back rather than priced on an assumption.
      const catalogPack = catalogItem(itemId)?.defaultPack ?? null;
      const pack = line.pack || catalogPack;
      const packSource = line.pack ? "invoice" : catalogPack ? "catalog" : null;

      if (!pack) {
        review.push({ kind: "no-pack-printed", invoice: inv.id, supplier: inv.supplier, code: line.code ?? null, description: line.description, itemId });
        continue;
      }

      try {
        const { unitCostCents, baseQuantity, base } = unitCost({ ...line, pack });
        observations.push({
          itemId, base, unitCostCents, baseQuantity, packSource,
          date: inv.date, supplier: inv.supplier, invoice: inv.id,
          description: line.description, pack,
          lineTotalCents: line.lineTotalCents,
        });
      } catch (err) {
        if (!(err instanceof UnitError)) throw err;
        review.push({ kind: "unreadable-pack", invoice: inv.id, supplier: inv.supplier, description: line.description, pack });
      }
    }

    // Against the goods subtotal where the invoice prints one, because the total
    // also carries freight, surcharges, deposits and tax, and those are not lines.
    const stated = inv.subtotalCents ?? inv.totalCents;
    if (stated != null && Math.abs(lineSum - stated) > 1) {
      review.push({
        kind: "does-not-reconcile", invoice: inv.id, supplier: inv.supplier,
        linesCents: lineSum, statedCents: stated,
        basis: inv.subtotalCents != null ? "subtotal" : "total",
      });
    }
  }

  return { observations, review };
}

function windows(observations, asOf) {
  const t = asOf.getTime();
  const inRange = (o, fromDaysAgo, toDaysAgo) => {
    const d = new Date(o.date).getTime();
    return d > t - fromDaysAgo * DAY && d <= t - toDaysAgo * DAY;
  };
  return {
    recent: observations.filter((o) => inRange(o, RULES.recentDays, 0)),
    baseline: observations.filter((o) => inRange(o, RULES.baselineStartDaysAgo, RULES.baselineEndDaysAgo)),
  };
}

/** Monthly quantity implied by the recent window, used to price a change. */
const monthlyQty = (recent) => (recent.reduce((a, o) => a + o.baseQuantity, 0) / RULES.recentDays) * 30.44;

function priceMove(itemId, recent, baseline) {
  if (recent.length < RULES.minRecentObservations) return null;
  if (baseline.length < RULES.minBaselineObservations) return null;

  const now = vwap(recent);
  const was = vwap(baseline);
  if (!now || !was) return null;

  const delta = (now - was) / was;
  const impact = (now - was) * monthlyQty(recent);
  const meta = catalogItem(itemId);

  const shared = {
    itemId, label: meta.label, base: meta.base, baseLabel: BASE_LABEL[meta.base],
    nowCents: now, wasCents: was, deltaPct: delta * 100,
    monthlyImpactCents: impact,
    evidence: {
      from: [...baseline].sort((a, b) => a.date.localeCompare(b.date))[0],
      to: [...recent].sort((a, b) => b.date.localeCompare(a.date))[0],
      recentInvoices: recent.length,
    },
  };

  if (delta >= RULES.creepPct && impact >= RULES.minMonthlyImpactCents) {
    return { ...shared, kind: "creep", level: "down" };
  }
  if (delta <= -RULES.reliefPct && -impact >= RULES.minMonthlyImpactCents) {
    return { ...shared, kind: "relief", level: "up" };
  }
  return null;
}

/**
 * The same thing, bought at two prices, in the same month.
 *
 * This one needs no history at all, which makes it the first finding a brand new
 * account can produce: it lands on week one instead of week sixteen.
 */
function supplierSpread(itemId, recent) {
  const bySupplier = new Map();
  for (const o of recent) {
    if (!bySupplier.has(o.supplier)) bySupplier.set(o.supplier, []);
    bySupplier.get(o.supplier).push(o);
  }
  const priced = [...bySupplier.entries()]
    .filter(([, obs]) => obs.length >= 2)
    .map(([supplier, obs]) => ({ supplier, unitCostCents: vwap(obs), qty: obs.reduce((a, o) => a + o.baseQuantity, 0) }))
    .sort((a, b) => a.unitCostCents - b.unitCostCents);

  if (priced.length < 2) return null;
  const cheap = priced[0];
  const dear = priced.at(-1);
  const gap = (dear.unitCostCents - cheap.unitCostCents) / cheap.unitCostCents;
  if (gap < RULES.supplierSpreadPct) return null;

  // Only the volume actually bought at the higher price is addressable.
  const impact = (dear.unitCostCents - cheap.unitCostCents) * (dear.qty / RULES.recentDays) * 30.44;
  if (impact < RULES.minMonthlyImpactCents) return null;

  const meta = catalogItem(itemId);
  return {
    kind: "spread", level: "down", itemId, label: meta.label, base: meta.base, baseLabel: BASE_LABEL[meta.base],
    cheap, dear, deltaPct: gap * 100, monthlyImpactCents: impact,
  };
}

/**
 * The cost moved and the menu did not.
 *
 * Attached to a rising item rather than reported on its own, because on its own it
 * is a lecture and attached it is a decision: here is the new plate cost, here is
 * what you charge, here is when you last looked.
 */
function menuLag(finding, asOf) {
  const meta = catalogItem(finding.itemId);
  if (!meta?.menu || finding.kind !== "creep") return null;

  const { item, priceCents, priceSetOn, basePerServe } = meta.menu;
  const daysStale = Math.round((asOf - new Date(priceSetOn)) / DAY);
  if (daysStale < RULES.baselineEndDaysAgo) return null;

  // Only this one ingredient's contribution. We deliberately do not turn that into
  // a margin percentage: we know what the cheese costs, not what the dough, the
  // labour and the box cost, and a margin figure built from one line would read as
  // a full plate cost and be wrong by a mile.
  const costNow = finding.nowCents * basePerServe;
  const costWas = finding.wasCents * basePerServe;
  return {
    item, priceCents, priceSetOn, daysStale,
    costNowCents: costNow, costWasCents: costWas,
    addedCostCents: costNow - costWas,
  };
}

export function findMoves(invoices, { asOf = new Date() } = {}) {
  const { observations, review } = ingest(invoices);
  const byItem = new Map();
  for (const o of observations) {
    if (!byItem.has(o.itemId)) byItem.set(o.itemId, []);
    byItem.get(o.itemId).push(o);
  }

  const findings = [];
  for (const [itemId, obs] of byItem) {
    const { recent, baseline } = windows(obs, asOf);

    const move = priceMove(itemId, recent, baseline);
    if (move) findings.push({ ...move, menu: menuLag(move, asOf) });

    const spread = supplierSpread(itemId, recent);
    if (spread) findings.push(spread);
  }

  findings.sort((a, b) => Math.abs(b.monthlyImpactCents) - Math.abs(a.monthlyImpactCents));

  const against = findings.filter((f) => f.level === "down").reduce((a, f) => a + f.monthlyImpactCents, 0);
  const forYou = findings.filter((f) => f.level === "up").reduce((a, f) => a + f.monthlyImpactCents, 0);

  return {
    findings,
    review,
    totals: {
      monthlyAgainstCents: against,
      monthlyForCents: forYou,
      monthlyNetCents: against + forYou,
      invoicesRead: invoices.length,
      linesPriced: observations.length,
      itemsTracked: byItem.size,
    },
    // One point per invoice per item, for the trend line beside each finding.
    series: Object.fromEntries(
      [...byItem].map(([id, obs]) => [
        id,
        [...obs].sort((a, b) => a.date.localeCompare(b.date))
          .map((o) => ({ date: o.date, unitCostCents: o.unitCostCents, supplier: o.supplier })),
      ]),
    ),
  };
}
