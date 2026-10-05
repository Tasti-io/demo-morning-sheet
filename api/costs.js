/**
 * GET /api/costs — what the supplier invoices say happened to your costs.
 *
 * Like /api/sheet, there is no model in this request path. The invoices were read
 * once, by extract.js, when they arrived; everything served here is arithmetic over
 * the stored line items. An open demo link therefore costs nothing per visitor, and
 * a curious stranger cannot run up a bill by refreshing.
 */
import { findMoves } from "../lib/invoices/drift.js";
import * as fixtures from "../lib/sources/invoices-fixtures.js";

export default async function handler(req, res) {
  const { invoices, meta } = fixtures.load({});
  const moves = findMoves(invoices, {});

  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(200).end(JSON.stringify({ ...meta, ...moves }, null, 2));
}
