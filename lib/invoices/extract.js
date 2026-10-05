/**
 * The one place a language model is allowed to touch this layer.
 *
 * A supplier invoice arrives as a PDF, or as a photo of a page taken on a phone in
 * a walk-in. Turning that into line items is exactly what a model is good at and
 * what twenty years of OCR templates were bad at, because every distributor's
 * layout is different and they all change it.
 *
 * The boundary is drawn hard, and it is the whole reason this is safe:
 *
 *   The model transcribes. It never calculates.
 *
 * It is asked for amounts as the strings printed on the page. This file converts
 * them to cents. drift.js derives every unit price and every dollar impact in
 * ordinary arithmetic. So the worst a bad transcription can do is misread a
 * number, which the reconciliation check in ingest() then catches by adding the
 * lines up and comparing them to the invoice's own stated total. A model asked to
 * produce the final figure would have no such check: it would simply be believed.
 *
 * It runs once per invoice, from the CLI or an inbox worker, never from a page
 * request. Nothing a visitor to the demo does can spend a cent of model time.
 */
import { matchItem } from "./catalog.js";

const API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5-5";

const TOOL = {
  name: "record_invoice",
  description: "Record the invoice exactly as printed. Transcribe only.",
  input_schema: {
    type: "object",
    properties: {
      supplier: { type: "string", description: "Supplier/vendor name as printed on the document" },
      invoiceNumber: { type: "string", description: "Invoice or document number, empty string if absent" },
      date: { type: "string", description: "Invoice date as YYYY-MM-DD" },
      currency: { type: "string", description: "Three letter currency code, CAD if not stated" },
      total: { type: "string", description: "Invoice total exactly as printed, e.g. '1,284.55'" },
      lines: {
        type: "array",
        description: "One entry per product line. Skip freight, deposits, taxes and summary rows.",
        items: {
          type: "object",
          properties: {
            description: { type: "string", description: "Product description exactly as printed" },
            pack: { type: "string", description: "Pack/size exactly as printed, e.g. '5 x 2.5 KG'. Empty string if the document does not print one." },
            cases: { type: "number", description: "Quantity of packs billed on this line" },
            lineTotal: { type: "string", description: "Extended line amount exactly as printed" },
          },
          required: ["description", "pack", "cases", "lineTotal"],
        },
      },
    },
    required: ["supplier", "date", "total", "lines"],
  },
};

const SYSTEM = [
  "You transcribe foodservice supplier invoices into structured line items.",
  "",
  "Rules, in order of importance:",
  "1. Transcribe. Never calculate. Do not derive a unit price, do not sum anything, do not correct a total that looks wrong. Report what the page says, including if it is inconsistent.",
  "2. Never invent. If a pack size is not printed, return an empty string for it. If a field is absent, leave it empty. A missing value is handled downstream; a guessed one is not.",
  "3. Product lines only. Skip freight, fuel surcharge, container deposits, tax lines, subtotals and totals as line items.",
  "4. Amounts exactly as printed, keeping the separators used on the page.",
].join("\n");

/** Printed money to integer cents. Handles '1,284.55', '$12.40', '(3.50)' credits. */
export function toCents(printed) {
  if (printed == null) return null;
  const s = String(printed).trim();
  const negative = /^\(.*\)$/.test(s) || s.startsWith("-");
  const digits = s.replace(/[()\-]/g, "").replace(/[^0-9.,]/g, "").replace(/,/g, "");
  if (!digits) return null;
  const value = Number(digits);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100) * (negative ? -1 : 1);
}

function contentBlock({ bytes, mediaType, text }) {
  if (text) return { type: "text", text };
  const data = Buffer.from(bytes).toString("base64");
  if (mediaType === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: mediaType, data } };
  }
  return { type: "image", source: { type: "base64", media_type: mediaType, data } };
}

/**
 * Read one invoice document into our invoice shape.
 *
 * Returns the invoice plus `unmatched`: descriptions no catalog alias covers. Those
 * are surfaced for a person to map once, not matched by the model on the fly. A
 * mapping a model re-decides on every run produces a price history that quietly
 * reorganises itself between Tuesday and Thursday.
 */
export async function extractInvoice({ bytes, mediaType, text, apiKey = process.env.ANTHROPIC_API_KEY, model = MODEL }) {
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const res = await fetch(API, {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "record_invoice" },
      messages: [{
        role: "user",
        content: [contentBlock({ bytes, mediaType, text }), { type: "text", text: "Record this invoice." }],
      }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const body = await res.json();
  const call = body.content?.find((c) => c.type === "tool_use");
  if (!call) throw new Error("the model returned no structured invoice");

  const raw = call.input;
  const unmatched = [];
  const lines = raw.lines.map((l) => {
    const itemId = matchItem(l.description);
    if (!itemId) unmatched.push(l.description);
    return {
      description: l.description,
      pack: l.pack || null,
      cases: Number(l.cases),
      lineTotalCents: toCents(l.lineTotal),
      itemId,
    };
  });

  return {
    invoice: {
      id: raw.invoiceNumber || `${raw.supplier}-${raw.date}`,
      supplier: raw.supplier,
      date: raw.date,
      currency: raw.currency || "CAD",
      totalCents: toCents(raw.total),
      lines,
    },
    unmatched,
    usage: body.usage,
  };
}
