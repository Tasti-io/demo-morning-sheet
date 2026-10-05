#!/usr/bin/env node
/**
 * Read one real supplier invoice and print what we got out of it.
 *
 * This is the thing to run in front of a prospect. They forward one invoice, this
 * prints their own line items with a unit price per kilogram beside each, and the
 * conversation stops being about software.
 *
 *   ANTHROPIC_API_KEY=... node scripts/parse-invoice.mjs ~/Downloads/invoice.pdf
 *   ANTHROPIC_API_KEY=... node scripts/parse-invoice.mjs photo.jpg --json > out.json
 *
 * Set the key in your shell, not in a file in this repo. Nothing here writes it
 * anywhere, and .env is gitignored for a reason.
 */
import { readFile } from "node:fs/promises";
import { extname, basename } from "node:path";
import { extractInvoice } from "../lib/invoices/extract.js";
import { unitCost, UnitError, BASE_LABEL } from "../lib/invoices/units.js";
import { ingest } from "../lib/invoices/drift.js";

const TYPES = { ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };
const args = process.argv.slice(2);
const asJson = args.includes("--json");
const path = args.find((a) => !a.startsWith("--"));

if (!path) {
  console.error("usage: node scripts/parse-invoice.mjs <invoice.pdf|photo.jpg> [--json]");
  process.exit(1);
}

const mediaType = TYPES[extname(path).toLowerCase()];
if (!mediaType) {
  console.error(`unsupported file type: ${extname(path)}. PDF, PNG, JPEG, WEBP or GIF.`);
  process.exit(1);
}

const money = (c) => (c == null ? "  n/a" : "$" + (c / 100).toFixed(2));

try {
  const bytes = await readFile(path);
  if (!asJson) console.error(`reading ${basename(path)} (${(bytes.length / 1024).toFixed(0)} KB)...`);

  const { invoice, unmatched, usage } = await extractInvoice({ bytes, mediaType });

  if (asJson) {
    console.log(JSON.stringify({ invoice, unmatched }, null, 2));
    process.exit(0);
  }

  console.log(`\n${invoice.supplier}   ${invoice.date}   invoice ${invoice.id}`);
  console.log("-".repeat(78));
  for (const l of invoice.lines) {
    let unit = "";
    try {
      const u = unitCost(l);
      unit = `${money(Math.round(u.unitCostCents))}/${BASE_LABEL[u.base]}`;
    } catch (err) {
      unit = err instanceof UnitError ? "pack unreadable" : (() => { throw err; })();
    }
    console.log(
      `${(l.description ?? "").slice(0, 38).padEnd(39)}` +
      `${String(l.pack ?? "").slice(0, 12).padEnd(13)}` +
      `${String(l.cases).padStart(4)}  ` +
      `${money(l.lineTotalCents).padStart(10)}  ` +
      `${unit.padStart(14)}`,
    );
  }
  console.log("-".repeat(78));

  const { review } = ingest([invoice]);
  const bad = review.find((r) => r.kind === "does-not-reconcile");
  console.log(
    bad
      ? `lines ${money(bad.linesCents)} vs stated total ${money(bad.statedCents)}  <- does not reconcile, check before trusting`
      : `lines add up to the stated total ${money(invoice.totalCents)}`,
  );

  if (unmatched.length) {
    console.log(`\n${unmatched.length} description(s) not in the catalog yet. Add an alias in lib/invoices/catalog.js:`);
    for (const d of unmatched) console.log(`  ${d}`);
  }
  if (usage) console.error(`\n(${usage.input_tokens} in / ${usage.output_tokens} out)`);
} catch (err) {
  console.error(`failed: ${err.message}`);
  process.exit(1);
}
