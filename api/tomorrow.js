/**
 * GET /api/tomorrow?date=YYYY-MM-DD — tomorrow's rota, proposed from tomorrow's demand.
 *
 * Defaults to tomorrow in Vancouver and accepts any of the next seven days, so a
 * visitor can step onto the long weekend or the holiday and watch the plan change.
 *
 * The weather is real: Open-Meteo, which needs no key, so there is no secret to leak
 * and nothing to bill. It is also the one outside call on this page, so it has a
 * short timeout and a fallback. If it does not answer, the plan is made without a
 * weather adjustment and the page says that, rather than failing in front of the
 * one prospect who mattered. No model is called anywhere in this request.
 */
import { plan } from "../lib/forecast/plan.js";
import { addDays, vancouverToday, statHoliday, longWeekend, shortName } from "../lib/forecast/bc.js";

const VANCOUVER = { lat: 49.2827, lon: -123.1207 };

async function weatherFor(iso) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: VANCOUVER.lat, longitude: VANCOUVER.lon, timezone: "America/Vancouver",
    daily: "weather_code,temperature_2m_max,precipitation_sum,precipitation_probability_max",
    start_date: iso, end_date: iso,
  });
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return null;
    const d = (await res.json()).daily;
    if (!d?.time?.[0]) return null;
    return {
      source: "Open-Meteo",
      code: d.weather_code[0],
      tempMaxC: d.temperature_2m_max[0],
      precipitationMm: d.precipitation_sum[0] ?? 0,
      precipitationChance: d.precipitation_probability_max[0] ?? null,
    };
  } catch {
    return null;
  }
}

/** A plain-words label for the WMO weather code Open-Meteo returns. */
const SKY = (c) =>
  c === 0 ? "clear" : c <= 3 ? "cloud" : c <= 48 ? "fog" : c <= 57 ? "drizzle" : c <= 67 ? "rain" : c <= 77 ? "snow" : c <= 82 ? "showers" : "thunderstorms";

export default async function handler(req, res) {
  const today = vancouverToday();
  const days = Array.from({ length: 7 }, (_, k) => addDays(today, k + 1));
  const asked = String(req.query?.date ?? "");
  const iso = days.includes(asked) ? asked : days[0];

  const weather = await weatherFor(iso);
  const body = plan(iso, weather);
  body.today = today;
  body.days = days;
  // A short tag for the day picker, so the holiday and the long weekend are visible
  // before anyone clicks on them.
  body.dayTags = Object.fromEntries(days
    .map((d) => [d, statHoliday(d) ? shortName(statHoliday(d)) : longWeekend(d) ? "long weekend" : null])
    .filter(([, v]) => v));
  body.weather = weather ? { ...weather, sky: SKY(weather.code) } : null;
  body.notice = weather ? null : "The weather service did not answer, so this plan has no weather adjustment.";

  // Cached at the edge for 15 minutes, never in the browser. The weather moves during
  // the day, and stale-while-revalidate in a browser would show a visitor the
  // previous plan while it quietly fetched the next one: a stale forecast on a page
  // about forecasting is its own argument against the product.
  res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  res.setHeader("CDN-Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(200).end(JSON.stringify(body));
}
