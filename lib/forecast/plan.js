/**
 * The proposal: tomorrow's rota, moved toward tomorrow's demand.
 *
 * It starts from the rota the manager would otherwise copy forward, and changes it
 * only where the forecast says the copy is wrong. That is the whole design. A
 * planner that built a rota from nothing would be easier to write and harder to
 * trust, because every line of it would need checking; one that starts from the
 * manager's own Friday only asks them to check the differences, each with a reason.
 *
 * The productivity it assumes is learned from that same rota: whatever the usual
 * Friday staffs per order is taken as right on average, and people are moved toward
 * the half hours that need them. So the claim is never "you need 3.4 servers", it is
 * "your own Friday puts four servers on at 14:00, and the rush starts at 17:30".
 *
 * Every shift carries a named person from start to finish. A planner that moved
 * anonymous slots and put names on afterwards would say "start Theo later" and then
 * give the new lunch shift to Theo as well.
 */
import { ROTA, WAGES, ROLES, STAFF, dayKind, OPEN_BY_DOW } from "../harbour/index.js";
import { SITES as BASE } from "../sources/fixtures.js";
import { dow, statHoliday, paidMinutes, shiftCost, ESA } from "./bc.js";
import { forecast, usualCurve, SLOT, ROTA_BUILT_FOR } from "./demand.js";

/** Roles whose numbers should follow the trade. The rest are the room's fixed crew. */
const FLEX = new Set(["server", "host", "runner", "bartender", "barista", "cook"]);

/**
 * How sure the forecast has to be before the rota moves. On a statutory holiday an
 * extra hour costs about two and a half times (s.46: 1.5x for the hours plus an
 * average day's pay), so the planner asks for a much bigger rush before it adds
 * anyone, and takes hours away more readily. That asymmetry is the judgement a
 * manager makes on a holiday, written down.
 */
const THRESHOLDS = { ordinary: { add: 0.8, cut: -0.7 }, stat: { add: 1.4, cut: -0.45 } };
const MAX_CHANGES_PER_SITE = 4;
const MIN_SHIFT = 3 * 60;
const MAX_SHIFT = ESA.dailyOvertimeAfterMin; // never propose daily overtime

export const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const label = (role) => ROLES[role].label.toLowerCase();
const plural = (role, n) => `${n} ${label(role)}${n === 1 ? "" : "s"}`;

const covers = (s, t) => s.start <= t && t < s.end;
const countAt = (shifts, role, t) => shifts.filter((s) => s.role === role && covers(s, t)).length;
const worksAt = (p, id) => p.site === id || (p.alsoAt ?? []).includes(id);
const smooth = (xs) => xs.map((_, i) => {
  const w = xs.slice(Math.max(0, i - 1), i + 2);
  return w.reduce((a, x) => a + x, 0) / w.length;
});

/**
 * The usual rota for one room, with a person on every shift that someone can work.
 * One shift per person per day across the whole group, room's own people first,
 * which is how demo-tips fills the same rota. A slot nobody can take stays empty and
 * is reported, never given an invented person.
 */
function staffRota(id, iso, busy) {
  const filled = [];
  const empty = [];
  for (const [role, start, end, count] of ROTA[id][dayKind(dow(iso))]) {
    for (let k = 0; k < count; k += 1) {
      const who = STAFF.filter((p) => p.role === role && worksAt(p, id) && !busy.has(p.id))
        .sort((a, b) => (a.site === id ? 0 : 1) - (b.site === id ? 0 : 1) || a.id.localeCompare(b.id))[0];
      if (who) { busy.add(who.id); filled.push({ role, start, end, who, origin: "rota" }); }
      else empty.push({ role, start, end });
    }
  }
  return { filled, empty };
}

/**
 * Orders per person per half hour, for one role, learned from the rota as it really
 * runs on an ordinary day. The built-for factor is what makes Langley different: its
 * rota was sized for more trade than it does.
 */
function productivity(id, iso, rota, role) {
  const usual = usualCurve(id, iso);
  const demand = usual.reduce((a, x) => a + x.orders, 0) * ROTA_BUILT_FOR[id];
  const staffSlots = usual.reduce((a, { t }) => a + countAt(rota, role, t), 0);
  return staffSlots ? demand / staffSlots : Infinity;
}

function gap(curve, shifts, role, per) {
  return smooth(curve.map(({ t, orders }) => {
    const on = countAt(shifts, role, t);
    if (!on) return 0; // a role nobody works at this hour is not one to add at this hour
    return Math.max(1, orders / per) - on;
  }));
}

function runs(values, test) {
  const out = [];
  let from = -1;
  values.forEach((v, i) => {
    if (test(v) && from < 0) from = i;
    if ((!test(v) || i === values.length - 1) && from >= 0) {
      out.push([from, test(v) ? i : i - 1]);
      from = -1;
    }
  });
  return out;
}

/**
 * Changes for one role. Order matters, and it is the order a manager works in: first
 * move the people already on toward the hours that need them, then add someone only
 * where a gap is left AND somebody is free to take it. A shift nobody can work is
 * not a proposal, so that case comes back as a note instead.
 */
function flexRole(id, iso, curve, rota, shifts, role, th, busy) {
  const per = productivity(id, iso, rota, role);
  if (!Number.isFinite(per)) return { changes: [], gaps: [] };
  const ts = curve.map((c) => c.t);
  const idx = (t) => ts.indexOf(t);
  const [open, close] = OPEN_BY_DOW[dow(iso)];
  const avgOver = (a, b) => {
    const w = ts.filter((t) => t >= a && t < b);
    return w.length ? Math.round(w.reduce((x, t) => x + curve[idx(t)].orders * 2, 0) / w.length) : 0;
  };
  const changes = [];
  const gaps = [];

  // 1. Troughs: start someone later, or send them home earlier, where the room is
  // carrying more of this role than the forecast needs. Never below one person on.
  let g = gap(curve, shifts, role, per);
  const mine = shifts.filter((s) => s.role === role).sort((x, y) => y.start - x.start);
  for (const s of mine) {
    const span = ts.filter((t) => covers(s, t));
    if (span.length < 2) continue;
    const surplus = (t) => g[idx(t)] <= th.cut && countAt(shifts, role, t) >= 2;

    let lead = 0;
    while (lead < span.length && surplus(span[lead])) lead += 1;
    let tail = 0;
    while (tail < span.length - lead && surplus(span[span.length - 1 - tail])) tail += 1;

    const newStart = lead >= 2 ? span[lead - 1] + SLOT : s.start;
    const newEnd = tail >= 2 ? span[span.length - tail] : s.end;
    if (newStart === s.start && newEnd === s.end) continue;

    if (newEnd - newStart < MIN_SHIFT) {
      if (!span.every((t) => countAt(shifts, role, t) >= 2)) continue;
      changes.push({
        type: "drop", role, who: s.who.name, from: { start: s.start, end: s.end }, _shift: s,
        reason: `Across ${fmt(s.start)} to ${fmt(s.end)} the forecast averages ${avgOver(s.start, s.end)} orders an hour, which the other ${label(role)}s on can carry.`,
      });
      shifts.splice(shifts.indexOf(s), 1);
    } else {
      const on = countAt(shifts, role, newStart !== s.start ? s.start : newEnd);
      const parts = [];
      if (newStart !== s.start) parts.push(`${fmt(s.start)} to ${fmt(newStart)} is forecast at ${avgOver(s.start, newStart)} orders an hour with ${plural(role, on)} on`);
      if (newEnd !== s.end) parts.push(`after ${fmt(newEnd)} it falls to ${avgOver(newEnd, s.end)} an hour`);
      const text = parts.join(", and ");
      changes.push({
        type: newStart !== s.start ? "later" : "earlier", role, who: s.who.name, _shift: s,
        from: { start: s.start, end: s.end }, to: { start: newStart, end: newEnd },
        reason: `${text[0].toUpperCase()}${text.slice(1)}.`,
      });
      s.start = newStart;
      s.end = newEnd;
      s.origin = "moved";
    }
    g = gap(curve, shifts, role, per);
  }

  // 2. Peaks: what is left uncovered after moving people. Add one person only if
  // somebody who does this job, at this room, is not already working anywhere today.
  for (const [a, b] of runs(g, (v) => v >= th.add)) {
    let start = ts[a];
    let end = ts[b] + SLOT;
    if (end - start < MIN_SHIFT) {
      const pad = (MIN_SHIFT - (end - start)) / 2;
      start = Math.max(open, start - Math.ceil(pad / SLOT) * SLOT);
      end = Math.min(close, start + MIN_SHIFT);
    }
    if (end - start > MAX_SHIFT) end = start + MAX_SHIFT;
    const before = countAt(shifts, role, ts[a]);
    const top = Math.max(...ts.slice(a, b + 1).map((t) => Math.round(curve[idx(t)].orders * 2)));
    const window = `${fmt(ts[a])} to ${fmt(ts[b] + SLOT)}`;
    const who = STAFF.filter((p) => p.role === role && worksAt(p, id) && !busy.has(p.id))
      .sort((x, y) => (x.site === id ? 0 : 1) - (y.site === id ? 0 : 1) || x.id.localeCompare(y.id))[0];
    if (!who) {
      const employed = STAFF.filter((p) => p.role === role && worksAt(p, id)).length;
      gaps.push({
        role, start: ts[a], end: ts[b] + SLOT,
        text: `${window} would carry one more ${label(role)} at up to ${top} orders an hour, but ${employed === 1 ? `the only ${label(role)} who works here is` : employed === 2 ? `both ${label(role)}s who work here are` : `all ${employed} ${label(role)}s who work here are`} already on today. Worth knowing before the rush; there is nobody free to add.`,
      });
      continue;
    }
    busy.add(who.id);
    const s = { role, start, end, who, origin: "add" };
    shifts.push(s);
    changes.push({
      type: "add", role, who: who.name, borrowed: who.site !== id ? who.site : null, to: { start, end }, _shift: s,
      reason: `${window} is forecast at up to ${top} orders an hour, and the usual ${DAY[dow(iso)]} has ${plural(role, before)} on then.`,
    });
    g = gap(curve, shifts, role, per);
  }
  return { changes, gaps };
}

function cost(shifts, stat) {
  let cents = 0;
  let statPremium = 0;
  let paid = 0;
  const lines = shifts.map((s) => {
    const c = shiftCost({ startMin: s.start, endMin: s.end, wageCents: WAGES[s.role], salaried: s.who.pay === "salary", stat });
    cents += c.cents;
    statPremium += c.statPremiumCents;
    paid += paidMinutes(s.start, s.end);
    return { ...s, paidMin: paidMinutes(s.start, s.end), mealBreak: s.end - s.start > ESA.mealBreakAfterMin, costCents: c.cents };
  });
  return { lines, cents, statPremium, paidMin: paid };
}

/**
 * Keep only the few changes worth a manager's attention, ranked by paid time moved,
 * and undo every one that is dropped, so the rota shown is exactly the rota planned.
 */
function keepTop(changes, shifts, busy) {
  if (changes.length <= MAX_CHANGES_PER_SITE) return changes;
  const weight = (c) => Math.abs((c.to ? c.to.end - c.to.start : 0) - (c.from ? c.from.end - c.from.start : 0));
  const keep = new Set([...changes].sort((a, b) => weight(b) - weight(a)).slice(0, MAX_CHANGES_PER_SITE));
  for (const c of changes) {
    if (keep.has(c)) continue;
    if (c.type === "add") { shifts.splice(shifts.indexOf(c._shift), 1); busy.delete(c._shift.who.id); }
    else if (c.type === "drop") shifts.push({ ...c._shift, start: c.from.start, end: c.from.end, origin: "rota" });
    else { c._shift.start = c.from.start; c._shift.end = c.from.end; c._shift.origin = "rota"; }
  }
  return changes.filter((c) => keep.has(c));
}

function planSite(id, iso, weather, busy) {
  const fc = forecast(id, iso, weather);
  const stat = !!statHoliday(iso);
  const th = stat ? THRESHOLDS.stat : THRESHOLDS.ordinary;

  const { filled: rota, empty } = staffRota(id, iso, busy);
  const shifts = rota.map((s) => ({ ...s }));
  const roles = [...new Set(rota.map((s) => s.role))].filter((r) => FLEX.has(r));
  const results = roles.map((r) => flexRole(id, iso, fc.curve, rota, shifts, r, th, busy));
  const changes = keepTop(results.flatMap((r) => r.changes), shifts, busy);
  changes.forEach((c, i) => {
    c.id = `${id}-${i + 1}`;
    c.deltaMin = (c.to ? paidMinutes(c.to.start, c.to.end) : 0) - (c.from ? paidMinutes(c.from.start, c.from.end) : 0);
    // Priced with the same function as the rota, so overriding a change moves the
    // page's labour figure by exactly what that change was worth, overtime and all.
    const salaried = STAFF.find((p) => p.name === c.who)?.pay === "salary";
    const price = (w) => (w ? shiftCost({ startMin: w.start, endMin: w.end, wageCents: WAGES[c.role], salaried, stat }).cents : 0);
    c.deltaCents = price(c.to) - price(c.from);
    delete c._shift;
  });
  // A person a dropped shift sent home is free again for the rest of the group.
  for (const c of changes) if (c.type === "drop") busy.delete(STAFF.find((p) => p.name === c.who)?.id);

  const usual = cost(rota, stat);
  const proposed = cost(shifts, stat);
  const sales = fc.salesCents;

  // The usual rota can already break a rule. The planner does not quietly fix it,
  // because the fix (an earlier finish, a second short shift) is a manager's call;
  // it says so, with the cost, every time that day comes round.
  const rules = stat ? [] : rota
    .filter((x) => x.who.pay !== "salary" && paidMinutes(x.start, x.end) > ESA.dailyOvertimeAfterMin)
    .map((x) => {
      const c = shiftCost({ startMin: x.start, endMin: x.end, wageCents: WAGES[x.role] });
      return {
        role: x.role, start: x.start, end: x.end, overtimeCents: c.overtimeCents,
        text: `The usual ${DAY[dow(iso)]} puts ${x.who.name}, ${label(x.role)}, on ${fmt(x.start)} to ${fmt(x.end)}: ${(paidMinutes(x.start, x.end) / 60).toFixed(1)} paid hours, past BC's 8 hour daily overtime line (Employment Standards Act s.40). The time over 8 hours costs 1.5 times, about ${"$"}${(c.overtimeCents / 100).toFixed(2)} extra each ${DAY[dow(iso)]}. An earlier finish or a second short shift would avoid it.`,
      };
    });

  // The headline role for the chart: the flexible role that carries the most hours
  // in this room. Baristas at a cafe, servers in a dining room. Picking by name put
  // Lonsdale's one server on the chart instead of its five baristas.
  const hoursOf = (r) => rota.filter((x) => x.role === r).reduce((a, x) => a + (x.end - x.start), 0);
  const lead = [...roles].sort((a, b) => hoursOf(b) - hoursOf(a))[0];
  const per = productivity(id, iso, rota, lead);
  const chart = fc.curve.map(({ t, orders }) => ({
    t,
    orders: orders * 2,
    before: countAt(rota, lead, t) * per * 2,
    after: countAt(shifts, lead, t) * per * 2,
  }));
  // What each change does to the chart's proposed line, so the page can rebuild the
  // line from only the changes a manager has kept. Without it, overriding a change
  // would leave the chart showing a rota nobody approved.
  const u = per * 2;
  for (const c of changes) {
    if (c.role !== lead) { c.cap = []; continue; }
    const w = [];
    if (c.type === "add") w.push({ from: c.to.start, to: c.to.end, d: u });
    else if (c.type === "drop") w.push({ from: c.from.start, to: c.from.end, d: -u });
    else {
      if (c.to.start > c.from.start) w.push({ from: c.from.start, to: c.to.start, d: -u });
      if (c.to.end < c.from.end) w.push({ from: c.to.end, to: c.from.end, d: -u });
    }
    c.cap = w;
  }

  // On a statutory holiday, eligible staff who are NOT working are still owed an
  // average day's pay (s.45). That cost does not depend on the rota, so it is kept
  // out of the labour figure and reported beside it.
  const working = new Set(shifts.map((s) => s.who.id));
  const statOff = stat
    ? STAFF.filter((p) => p.site === id && p.pay === "hourly" && !working.has(p.id)).reduce((a, p) => a + Math.round(7.5 * WAGES[p.role]), 0)
    : 0;

  const b = BASE.find((x) => x.harbourId === id);
  return {
    id,
    name: b.name,
    format: b.format,
    hours: OPEN_BY_DOW[dow(iso)].map(fmt),
    forecast: {
      orders: Math.round(fc.orders),
      salesCents: sales,
      usualOrders: Math.round(fc.usualOrders),
      baselineOrders: Math.round(fc.baselineOrders),
      rotaOrders: Math.round(fc.rotaOrders),
      baselineDates: fc.baselineDates,
      adjustments: fc.adjustments,
    },
    lead,
    chart,
    changes,
    gaps: results.flatMap((r) => r.gaps).slice(0, 1),
    rules,
    shifts: proposed.lines.map((l) => ({
      role: l.role, start: l.start, end: l.end, paidMin: l.paidMin, mealBreak: l.mealBreak, costCents: l.costCents,
      who: l.who.name, borrowed: l.who.site !== id ? l.who.site : null, origin: l.origin,
    })).sort((x, y) => x.start - y.start || x.role.localeCompare(y.role)),
    unfilledUsual: empty,
    usual: { paidMin: usual.paidMin, cents: usual.cents, pct: sales ? (usual.cents / sales) * 100 : 0 },
    proposed: { paidMin: proposed.paidMin, cents: proposed.cents, pct: sales ? (proposed.cents / sales) * 100 : 0, statPremiumCents: proposed.statPremium },
    statOffCents: statOff,
  };
}

export function plan(iso, weather) {
  // One shift per person per day across the whole group, so the rooms are planned
  // in turn against a shared list of who is already working.
  const busy = new Set();
  const sites = BASE.map((b) => planSite(b.harbourId, iso, weather, busy));
  const sum = (f) => sites.reduce((a, s) => a + f(s), 0);
  const sales = sum((s) => s.forecast.salesCents);
  return {
    date: iso,
    weekday: DAY[dow(iso)],
    stat: statHoliday(iso),
    sites,
    totals: {
      orders: sum((s) => s.forecast.orders),
      salesCents: sales,
      changes: sum((s) => s.changes.length),
      usualCents: sum((s) => s.usual.cents),
      proposedCents: sum((s) => s.proposed.cents),
      usualPaidMin: sum((s) => s.usual.paidMin),
      proposedPaidMin: sum((s) => s.proposed.paidMin),
      usualPct: sales ? (sum((s) => s.usual.cents) / sales) * 100 : 0,
      proposedPct: sales ? (sum((s) => s.proposed.cents) / sales) * 100 : 0,
      statPremiumCents: sum((s) => s.proposed.statPremiumCents),
      statOffCents: sum((s) => s.statOffCents),
      unfilledUsual: sum((s) => s.unfilledUsual.length),
    },
  };
}
