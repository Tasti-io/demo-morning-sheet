/**
 * The morning sheet's data shape, and the one function that builds it.
 *
 * This is deliberately the whole product: a multi-site operator does not need a
 * dashboard, they need the one page they would otherwise assemble by hand before
 * opening. Everything here answers "what do I need to know before I start".
 *
 * The source is swappable. `fixtures` runs with no credentials at all so the demo
 * can never break in front of a prospect; `square` pulls the same shape out of a
 * Square sandbox. Both produce identical output, which is the point: the sheet
 * does not care where the numbers came from, and neither does the buyer.
 */

/** Money arrives from Square as integer cents. It stays integer until it is printed. */
export const money = (cents) =>
  "$" + (cents / 100).toLocaleString("en-CA", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const pct = (n) => `${n.toFixed(1)}%`;

/**
 * An exception is a site that moved against ITS OWN normal, not against the group.
 * Comparing a 90-seat room to a kiosk tells you nothing; comparing a room to its
 * own four-week median for the same weekday tells you where to look first. That
 * distinction is the entire difference between a report and a useful report.
 */
export function exceptions(site) {
  const out = [];
  const vsNormal = (site.netSales - site.medianSales) / site.medianSales;

  if (vsNormal <= -0.18) {
    out.push({
      level: "down",
      text: `${pct(Math.abs(vsNormal) * 100)} below its own ${site.weekday} median`,
    });
  } else if (vsNormal >= 0.22) {
    out.push({
      level: "up",
      text: `${pct(vsNormal * 100)} above its own ${site.weekday} median`,
    });
  }

  // Labour is the number that quietly eats a week, so it gets its own threshold
  // rather than hiding inside a sales comparison.
  if (site.labourPct >= 34) {
    out.push({ level: "down", text: `labour at ${pct(site.labourPct)} of sales` });
  }

  // Voids are only interesting as a rate. Three voids in a 600-cover day is noise;
  // three in a 40-cover day is a conversation with a manager.
  const voidRate = site.voids / Math.max(site.orders, 1);
  if (site.voids >= 3 && voidRate >= 0.04) {
    out.push({ level: "down", text: `${site.voids} voids on ${site.orders} orders` });
  }

  if (site.closedEarly) {
    out.push({ level: "flat", text: "last sale well before closing time" });
  }

  return out;
}

export function buildSheet(sites, meta) {
  const withFlags = sites.map((s) => ({ ...s, exceptions: exceptions(s) }));
  const needsAttention = withFlags.filter((s) => s.exceptions.some((e) => e.level === "down"));

  const totals = withFlags.reduce(
    (acc, s) => ({
      netSales: acc.netSales + s.netSales,
      orders: acc.orders + s.orders,
      labourCost: acc.labourCost + s.labourCost,
      voids: acc.voids + s.voids,
    }),
    { netSales: 0, orders: 0, labourCost: 0, voids: 0 },
  );

  return {
    ...meta,
    sites: withFlags,
    needsAttention: needsAttention.map((s) => s.name),
    totals: {
      ...totals,
      labourPct: totals.netSales ? (totals.labourCost / totals.netSales) * 100 : 0,
      avgTicket: totals.orders ? totals.netSales / totals.orders : 0,
    },
  };
}
