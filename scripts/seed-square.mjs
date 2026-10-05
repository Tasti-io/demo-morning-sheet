#!/usr/bin/env node
/**
 * Seed a Square SANDBOX account with a believable four-site operator.
 *
 * Square ships one mock location per application and offers no bulk import, so the
 * only way to get a multi-site sandbox is to build it through the API. This script
 * does that: it adds the missing locations, then writes a day of orders and labour
 * shifts across all of them.
 *
 * Sandbox only. The base URL is pinned and there is no production branch, so this
 * cannot write into a real seller's account even if handed the wrong token.
 *
 *   SQUARE_SANDBOX_TOKEN=... node scripts/seed-square.mjs
 *   SQUARE_SANDBOX_TOKEN=... node scripts/seed-square.mjs --dry-run
 */
const BASE = "https://connect.squareupsandbox.com";
const VERSION = "2026-08-20";
const TOKEN = process.env.SQUARE_SANDBOX_TOKEN;
const DRY = process.argv.includes("--dry-run");

if (!TOKEN) {
  console.error("SQUARE_SANDBOX_TOKEN is not set.");
  console.error("Developer Console -> your app -> Sandbox -> Access token.");
  process.exit(1);
}
if (TOKEN.startsWith("EAAA") && !TOKEN.includes("sandbox") && !DRY) {
  // Square sandbox tokens are prefixed EAAAl..., production EAAAE.... This is a
  // weak signal, so it warns rather than blocks, but a wrong token here would be
  // writing invented orders into a real business.
  console.warn("! That token does not look like a sandbox token. The base URL is sandbox-only,");
  console.warn("! so a production token will simply fail to authenticate. Nothing can reach production.");
}

const SITES = [
  { name: "Harbour Street", address: "1055 Canada Pl", locality: "Vancouver" },
  { name: "Lonsdale", address: "123 Lonsdale Ave", locality: "North Vancouver" },
  { name: "Oakridge food hall", address: "650 W 41st Ave", locality: "Vancouver" },
  { name: "Langley", address: "20151 86 Ave", locality: "Langley" },
];

const PROFILE = {
  "Harbour Street": { orders: 412, ticket: 2180, staff: 9, hourly: 2100 },
  Lonsdale: { orders: 268, ticket: 1640, staff: 6, hourly: 2000 },
  "Oakridge food hall": { orders: 331, ticket: 1190, staff: 5, hourly: 1950 },
  Langley: { orders: 197, ticket: 2040, staff: 7, hourly: 2000 },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let calls = 0;

async function api(path, init = {}) {
  calls += 1;
  if (DRY) return { __dry: true };
  // Square's sandbox rate limit is generous but not infinite, and a seeder that
  // trips it leaves the account half-built, which is worse than a slow seeder.
  if (calls % 20 === 0) await sleep(1000);
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Square-Version": VERSION,
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status} ${JSON.stringify(body).slice(0, 300)}`);
  }
  return body;
}

const uid = () => `tasti-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

async function ensureLocations() {
  const { locations = [] } = await api("/v2/locations");
  const existing = new Map(locations.map((l) => [l.name, l]));
  const out = [];

  for (const site of SITES) {
    if (existing.has(site.name)) {
      out.push(existing.get(site.name));
      console.log(`  = ${site.name} (already there)`);
      continue;
    }
    if (DRY) {
      console.log(`  + ${site.name} (would create)`);
      out.push({ id: `DRY-${site.name}`, name: site.name });
      continue;
    }
    try {
      const { location } = await api("/v2/locations", {
        method: "POST",
        body: JSON.stringify({
          location: {
            name: site.name,
            address: {
              address_line_1: site.address,
              locality: site.locality,
              administrative_district_level_1: "BC",
              country: "CA",
            },
            timezone: "America/Vancouver",
            status: "ACTIVE",
          },
        }),
      });
      out.push(location);
      console.log(`  + ${site.name}`);
    } catch (err) {
      // Some sandbox accounts cap location count. Say so plainly and keep what we have.
      console.warn(`  ! could not create ${site.name}: ${String(err.message).slice(0, 160)}`);
    }
  }
  return out;
}

function yesterdayISO(hour, minute) {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

async function seedDay(locations) {
  for (const loc of locations) {
    const p = PROFILE[loc.name] ?? { orders: 120, ticket: 1500, staff: 4, hourly: 2000 };
    // A seeded demo does not need 400 real orders to look right; it needs enough
    // that the totals are plausible. Each written order carries a multiplier so the
    // sheet's arithmetic still lands on the profile's day.
    const WRITE = 24;
    const perOrder = Math.round((p.orders * p.ticket) / WRITE);

    console.log(`  ${loc.name}: ${WRITE} orders (~${p.orders} covers worth), ${p.staff} shifts`);
    if (DRY) continue;

    for (let i = 0; i < WRITE; i += 1) {
      const hour = 11 + Math.floor((i / WRITE) * 10);
      const amount = Math.max(500, Math.round(perOrder * (0.8 + Math.random() * 0.4)));
      const { order } = await api("/v2/orders", {
        method: "POST",
        body: JSON.stringify({
          idempotency_key: uid(),
          order: {
            location_id: loc.id,
            line_items: [
              { name: "Day trade", quantity: "1", base_price_money: { amount, currency: "CAD" } },
            ],
            state: "OPEN",
          },
        }),
      });
      await api(`/v2/orders/${order.id}/pay`, {
        method: "POST",
        body: JSON.stringify({ idempotency_key: uid(), payment_ids: [] }),
      }).catch(async () => {
        // Paying with no payment ids is rejected on some sandbox configurations;
        // closing the order directly still produces a COMPLETED order to read.
        await api(`/v2/orders/${order.id}`, {
          method: "PUT",
          body: JSON.stringify({
            idempotency_key: uid(),
            order: { location_id: loc.id, version: order.version, state: "COMPLETED" },
          }),
        }).catch(() => {});
      });
      void hour;
    }

    for (let s = 0; s < p.staff; s += 1) {
      await api("/v2/labor/shifts", {
        method: "POST",
        body: JSON.stringify({
          idempotency_key: uid(),
          shift: {
            location_id: loc.id,
            start_at: yesterdayISO(10 + (s % 3) * 2, 0),
            end_at: yesterdayISO(17 + (s % 3) * 2, 30),
            wage: { title: "Team", hourly_rate: { amount: p.hourly, currency: "CAD" } },
          },
        }),
      }).catch((err) => console.warn(`    ! shift skipped: ${String(err.message).slice(0, 120)}`));
    }
  }
}

(async () => {
  console.log(DRY ? "DRY RUN — nothing will be written\n" : "Seeding Square sandbox\n");
  console.log("Locations:");
  const locations = await ensureLocations();
  if (!locations.length) {
    console.error("\nNo locations available. Nothing to seed.");
    process.exit(1);
  }
  console.log("\nYesterday's trade:");
  await seedDay(locations);
  console.log(`\nDone. ${calls} API calls.`);
  console.log("Point the demo at it with DEMO_SOURCE=square.");
})().catch((err) => {
  console.error("\nFailed:", err.message);
  process.exit(1);
});
