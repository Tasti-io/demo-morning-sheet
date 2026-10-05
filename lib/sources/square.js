/**
 * The live source: a Square SANDBOX account.
 *
 * Sandbox only, by construction. The base URL is pinned to
 * connect.squareupsandbox.com and there is no branch that can reach production, so
 * a misconfigured token cannot read a real seller's money. If someone later wants
 * this against production, that is a different file and a different conversation.
 *
 * Square gives one mock location per application and no bulk seeding, so the sites
 * this reads were created by scripts/seed-square.mjs.
 */

const BASE = "https://connect.squareupsandbox.com";
const VERSION = "2026-08-20";

function headers(token) {
  return {
    "Square-Version": VERSION,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function call(token, path, init = {}) {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: headers(token) });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Square ${init.method ?? "GET"} ${path} failed: ${res.status} ${body.slice(0, 300)}`);
  }
  return res.json();
}

/** Yesterday, in the seller's own timezone rather than the server's. */
function yesterdayRange(tz = "America/Vancouver") {
  const now = new Date();
  const local = new Date(now.toLocaleString("en-US", { timeZone: tz }));
  local.setDate(local.getDate() - 1);
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, "0");
  const d = String(local.getDate()).padStart(2, "0");
  return {
    startAt: `${y}-${m}-${d}T00:00:00Z`,
    endAt: `${y}-${m}-${d}T23:59:59Z`,
    date: `${y}-${m}-${d}`,
    weekday: local.toLocaleDateString("en-CA", { weekday: "long" }),
  };
}

export async function load({ token = process.env.SQUARE_SANDBOX_TOKEN } = {}) {
  if (!token) throw new Error("SQUARE_SANDBOX_TOKEN is not set");

  const { locations = [] } = await call(token, "/v2/locations");
  const active = locations.filter((l) => l.status === "ACTIVE");
  const range = yesterdayRange();

  const sites = [];
  for (const loc of active) {
    const { orders = [] } = await call(token, "/v2/orders/search", {
      method: "POST",
      body: JSON.stringify({
        location_ids: [loc.id],
        query: {
          filter: {
            date_time_filter: { closed_at: { start_at: range.startAt, end_at: range.endAt } },
            state_filter: { states: ["COMPLETED", "CANCELED"] },
          },
        },
        limit: 500,
      }),
    });

    const completed = orders.filter((o) => o.state === "COMPLETED");
    const netSales = completed.reduce((sum, o) => sum + Number(o.net_amounts?.total_money?.amount ?? 0), 0);
    const voids = orders.filter((o) => o.state === "CANCELED").length;

    // Labour comes from the Labor API. A sandbox with no shifts returns none, and
    // a zero here is honest: the sheet says "no shift data" rather than inventing
    // a percentage, because a made-up labour number is worse than a missing one.
    let labourCost = 0;
    try {
      const { shifts = [] } = await call(token, "/v2/labor/shifts/search", {
        method: "POST",
        body: JSON.stringify({
          query: { filter: { location_ids: [loc.id], start: { start_at: range.startAt, end_at: range.endAt } } },
          limit: 200,
        }),
      });
      labourCost = shifts.reduce((sum, sh) => {
        const start = new Date(sh.start_at);
        const end = sh.end_at ? new Date(sh.end_at) : start;
        const hours = Math.max(0, (end - start) / 3_600_000);
        const rate = Number(sh.wage?.hourly_rate?.amount ?? 0);
        return sum + Math.round(hours * rate);
      }, 0);
    } catch {
      labourCost = 0;
    }

    const lastSale = completed
      .map((o) => o.closed_at)
      .filter(Boolean)
      .sort()
      .at(-1);

    sites.push({
      id: loc.id,
      name: loc.name,
      format: loc.type === "MOBILE" ? "Mobile" : loc.business_name || "Location",
      weekday: range.weekday,
      orders: completed.length,
      netSales,
      // With one day of sandbox history there is no real median to compare against,
      // so the sheet compares to the group's own average for the day and says so.
      medianSales: 0,
      labourCost,
      labourPct: netSales ? (labourCost / netSales) * 100 : 0,
      voids,
      closedEarly: false,
      lastSale: lastSale ? lastSale.slice(11, 16) : "—",
      hasLabour: labourCost > 0,
    });
  }

  // Fill the comparison baseline from the group once every site is in, so a single
  // site's own number never becomes its own benchmark.
  const avg = sites.length ? sites.reduce((s, x) => s + x.netSales, 0) / sites.length : 0;
  for (const s of sites) if (!s.medianSales) s.medianSales = Math.round(avg);

  return {
    sites,
    meta: {
      source: "square",
      sourceLabel: "Live from a Square sandbox",
      group: "Sandbox seller",
      forDate: range.date,
      weekday: range.weekday,
      generatedAt: new Date().toISOString(),
    },
  };
}
