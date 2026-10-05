/**
 * GET /api/sheet — the morning sheet as JSON.
 *
 * Defaults to fixtures. A public demo that depends on a third party is a demo that
 * breaks in front of the one prospect who mattered, so the live Square path is
 * opt-in via DEMO_SOURCE and still falls back rather than erroring: a prospect
 * should see the sheet, not a stack trace.
 *
 * No LLM is involved anywhere in this endpoint. That is deliberate — it means an
 * open demo link costs nothing per visitor and cannot be run up by a stranger.
 */
import { buildSheet } from "../lib/shape.js";
import * as fixtures from "../lib/sources/fixtures.js";
import * as square from "../lib/sources/square.js";

export default async function handler(req, res) {
  const wanted = (req.query?.source || process.env.DEMO_SOURCE || "fixtures").toLowerCase();
  let notice = null;
  let payload;

  if (wanted === "square") {
    try {
      payload = await square.load({});
    } catch (err) {
      // Say what happened rather than silently pretending the sandbox answered.
      notice = `Square sandbox unavailable (${String(err.message).slice(0, 120)}), showing sample data.`;
      payload = fixtures.load({});
    }
  } else {
    payload = fixtures.load({});
  }

  const sheet = buildSheet(payload.sites, { ...payload.meta, notice });

  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(200).end(JSON.stringify(sheet, null, 2));
}
