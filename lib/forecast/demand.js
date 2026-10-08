/**
 * Tomorrow's demand, by half hour, for each room.
 *
 * This is deliberately a baseline, not a model. For each half hour it takes the
 * median of the last four ordinary same weekdays, then applies stated adjustments
 * for the calendar and the weather. On a real client the history is their own POS
 * and the adjustments are fitted from it; here the history is generated and the
 * adjustments are assumptions, and the page says so.
 *
 * The point of the Tomorrow tab is what happens after the forecast: the rota it
 * proposes and the reasons it gives. A forecast that was secretly clever would make
 * that harder to judge, not easier.
 */
import { SITES as BASE } from "../sources/fixtures.js";
import { OPEN_BY_DOW, dayKind } from "../harbour/index.js";
import { addDays, dow, statHoliday, longWeekend, shortName } from "./bc.js";

export const SLOT = 30; // minutes

/** Busier at the end of the week. Sunday trades short hours, so it sits lowest. */
const WEEKDAY = [0.82, 0.88, 0.9, 0.95, 1.0, 1.25, 1.3];

/**
 * Where in the day each room's trade falls: weights for a breakfast, a lunch and an
 * evening peak. Weekends put the morning peak at brunch instead of breakfast.
 */
const SHAPE = {
  harbour: { wk: [0.25, 0.55, 0.2], fri: [0.18, 0.37, 0.45], sat: [0.25, 0.3, 0.45], sun: [0.7, 0.3, 0] },
  lonsdale: { wk: [0.5, 0.38, 0.12], fri: [0.42, 0.33, 0.25], sat: [0.45, 0.35, 0.2], sun: [0.6, 0.4, 0] },
  oakridge: { wk: [0.2, 0.62, 0.18], fri: [0.18, 0.52, 0.3], sat: [0.15, 0.55, 0.3], sun: [0.25, 0.75, 0] },
  langley: { wk: [0.25, 0.5, 0.25], fri: [0.18, 0.32, 0.5], sat: [0.25, 0.3, 0.45], sun: [0.65, 0.35, 0] },
};

/**
 * How much trade each room's rota was built for, relative to what it does now. One
 * room is the story: Langley's rota was sized for a busier room than Langley is,
 * which is why the morning sheet keeps flagging its labour. Everywhere else the rota
 * was sized about right, and the work is moving people to the right hours.
 */
export const ROTA_BUILT_FOR = { harbour: 1.0, lonsdale: 1.0, oakridge: 0.95, langley: 1.15 };

const site = (id) => BASE.find((s) => s.harbourId === id);

function seeded(text) {
  let s = 0;
  for (const c of text) s = (s * 31 + c.charCodeAt(0)) % 4294967296;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** The half hours a room is open on that date: start of each slot, in minutes. */
export function slots(iso) {
  const [open, close] = OPEN_BY_DOW[dow(iso)];
  const out = [];
  for (let t = open; t < close; t += SLOT) out.push(t);
  return out;
}

const bump = (t, centre, width) => Math.exp(-((t - centre) ** 2) / (2 * width * width));

/** The shape of an ordinary day at this room: orders per half hour, summing to the day. */
export function usualCurve(id, iso) {
  const d = dow(iso);
  const kind = dayKind(d);
  const [b, l, e] = SHAPE[id][kind];
  const morning = kind === "sat" || kind === "sun" ? 10 * 60 + 30 : id === "lonsdale" ? 7 * 60 + 45 : 8 * 60 + 15;
  const ts = slots(iso);
  const w = ts.map((t) => b * bump(t + 15, morning, 70) + l * bump(t + 15, 12 * 60 + 30, 75) + e * bump(t + 15, 18 * 60 + 30, 90) + 0.02);
  const sum = w.reduce((a, x) => a + x, 0);
  const daily = site(id).baseOrders * WEEKDAY[d];
  return ts.map((t, i) => ({ t, orders: (daily * w[i]) / sum }));
}

/**
 * One past day, as the POS would have recorded it: the usual shape, moved by that
 * week's drift and that day's noise. Deterministic, so the page reads the same in an
 * email screenshot as it does on load.
 */
function observed(id, iso) {
  const rnd = seeded(`${id}:${iso}`);
  const week = Math.floor(new Date(`${iso}T12:00:00Z`).getTime() / (7 * 864e5));
  const drift = 1 + 0.035 * Math.sin(week * 1.3 + id.length);
  const day = 0.95 + rnd() * 0.1;
  return usualCurve(id, iso).map(({ t, orders }) => ({ t, orders: orders * drift * day * (0.92 + rnd() * 0.16) }));
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * The last four same weekdays, skipping statutory holidays, so Labour Day does not
 * teach the forecast what an ordinary Monday looks like.
 */
export function baselineDates(iso) {
  const out = [];
  for (let k = 1; out.length < 4 && k < 12; k += 1) {
    const d = addDays(iso, -7 * k);
    if (!statHoliday(d)) out.push(d);
  }
  return out;
}

export function baseline(id, iso) {
  const days = baselineDates(iso).map((d) => observed(id, d));
  return slots(iso).map((t, i) => ({ t, orders: median(days.map((day) => day[i]?.orders ?? 0)) }));
}

/**
 * Assumed effects, per room. Every number here is an assumption about a fictional
 * group, and the page labels it as one. On a real client these are fitted from their
 * own history: how much a wet Friday actually moved each room last year.
 */
const EFFECTS = {
  rain: { harbour: -0.08, lonsdale: -0.04, oakridge: 0.05, langley: -0.03 },
  warm: { harbour: 0.06, lonsdale: 0.02, oakridge: -0.03, langley: 0.02 },
  eve: { harbour: 0.05, lonsdale: -0.04, oakridge: 0.06, langley: -0.07 },
  stat: { harbour: 0.1, lonsdale: -0.12, oakridge: -0.1, langley: 0.06 },
};

const WHY = {
  rain: { harbour: "waterfront room, patio closed, less foot traffic", lonsdale: "fewer walk-ins", oakridge: "an indoor mall gains on a wet day", langley: "mostly drive-in trade" },
  warm: { harbour: "patio weather", lonsdale: "a little busier", oakridge: "the mall loses to the outdoors", langley: "a little busier" },
  eve: { harbour: "visitors downtown", lonsdale: "commuters leave early", oakridge: "shopping before the weekend", langley: "families leave town" },
  stat: { harbour: "holiday brunch", lonsdale: "no commuters", oakridge: "shorter mall trade", langley: "families at home" },
};

/** Rain that matters to a restaurant: a real amount, or a likely wet day. */
const RAIN_CODES = new Set([51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
export function isWet(w) {
  return !!w && (w.precipitationMm >= 3 || (RAIN_CODES.has(w.code) && (w.precipitationChance ?? 0) >= 60));
}
export const isWarm = (w) => !!w && w.tempMaxC >= 24 && (w.precipitationMm ?? 0) < 1;

export function adjustments(id, iso, weather) {
  const out = [];
  const stat = statHoliday(iso);
  const eve = longWeekend(iso);
  if (stat) out.push({ kind: "calendar", key: "stat", label: `${stat}, a BC statutory holiday`, factor: 1 + EFFECTS.stat[id], why: WHY.stat[id] });
  else if (eve) out.push({ kind: "calendar", key: "eve", label: `the ${shortName(eve)} long weekend`, factor: 1 + EFFECTS.eve[id], why: WHY.eve[id] });
  if (isWet(weather)) out.push({ kind: "weather", key: "rain", label: `rain forecast, ${weather.precipitationMm.toFixed(1)} mm`, factor: 1 + EFFECTS.rain[id], why: WHY.rain[id] });
  else if (isWarm(weather)) out.push({ kind: "weather", key: "warm", label: `${Math.round(weather.tempMaxC)} degrees and dry`, factor: 1 + EFFECTS.warm[id], why: WHY.warm[id] });
  return out;
}

/** Tomorrow, per half hour, with every input that moved it. */
export function forecast(id, iso, weather) {
  const base = baseline(id, iso);
  const adj = adjustments(id, iso, weather);
  const factor = adj.reduce((a, x) => a * x.factor, 1);
  const curve = base.map(({ t, orders }) => ({ t, orders: orders * factor }));
  const s = site(id);
  const orders = curve.reduce((a, x) => a + x.orders, 0);
  const usual = usualCurve(id, iso).reduce((a, x) => a + x.orders, 0);
  const baseOrders = base.reduce((a, x) => a + x.orders, 0);
  return {
    curve,
    adjustments: adj,
    orders,
    salesCents: Math.round(orders * s.ticket),
    usualOrders: usual,
    baselineOrders: baseOrders,
    baselineDates: baselineDates(iso),
    /** What the usual rota is staffed for, against what the room has actually done. */
    rotaOrders: usual * ROTA_BUILT_FOR[id],
  };
}
