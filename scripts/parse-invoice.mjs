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
import { item as catalogItem } from "../lib/invoices/catalog.js";

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
  console.log("-".repeat(86));
  for (const l of invoice.lines) {
    const catalogPack = l.itemId ? catalogItem(l.itemId)?.defaultPack : null;
    const pack = l.pack || catalogPack;
    let unit;
    if (!pack) {
      unit = "no pack printed";
    } else {
      try {
        const u = unitCost({ ...l, pack });
        unit = `${money(Math.round(u.unitCostCents))}/${BASE_LABEL[u.base]}${l.pack ? "" : " *"}`;
      } catch (err) {
        if (!(err instanceof UnitError)) throw err;
        unit = "pack unreadable";
      }
    }
    console.log(
      `${String(l.code ?? "").slice(0, 9).padEnd(10)}` +
      `${(l.description ?? "").slice(0, 34).padEnd(35)}` +
      `${String(pack ?? "").slice(0, 11).padEnd(12)}` +
      `${String(l.cases).padStart(4)}  ` +
      `${money(l.lineTotalCents).padStart(10)}  ` +
      `${unit.padStart(15)}`,
    );
  }
  console.log("-".repeat(86));
  if (invoice.lines.some((l) => !l.pack && l.itemId && catalogItem(l.itemId)?.defaultPack)) {
    console.log("* pack size came from the catalog, not from this document");
  }

  const { review } = ingest([invoice]);
  const bad = review.find((r) => r.kind === "does-not-reconcile");
  const basis = invoice.subtotalCents != null ? "subtotal" : "total";
  const stated = invoice.subtotalCents ?? invoice.totalCents;
  console.log(
    bad
      ? `product lines ${money(bad.linesCents)} vs stated ${bad.basis} ${money(bad.statedCents)}  <- does not reconcile, check before trusting`
      : `product lines add up to the stated ${basis} ${money(stated)}`,
  );
  // Only worth a line when the two actually differ; on a receipt with no freight
  // or tax they are the same number and saying so twice is noise.
  if (invoice.totalCents != null && stated != null && invoice.totalCents !== stated) {
    console.log(`invoice total ${money(invoice.totalCents)}, the difference being freight, deposits and tax, which are not tracked as items`);
  }

  const noPack = review.filter((r) => r.kind === "no-pack-printed");
  if (noPack.length) {
    console.log(`\n${noPack.length} line(s) matched an item but printed no pack size, so they carry no price per unit yet.`);
    console.log(`Weigh the package once and add defaultPack to that entry in lib/invoices/catalog.js:`);
    for (const r of [...new Map(noPack.map((r) => [r.itemId, r])).values()]) {
      console.log(`  ${r.itemId}: defaultPack: "1.5 kg"   (${r.code ?? "no code"}  ${r.description})`);
    }
  }

  if (unmatched.length) {
    const once = [...new Set(unmatched)];
    console.log(`\n${once.length} description(s) not in the catalog yet. Add an alias, or better the item code, in lib/invoices/catalog.js:`);
    for (const d of once) console.log(`  ${d}`);
  }
  if (usage) console.error(`\n(${usage.input_tokens} in / ${usage.output_tokens} out)`);
} catch (err) {
  console.error(`failed: ${err.message}`);
  process.exit(1);
}
