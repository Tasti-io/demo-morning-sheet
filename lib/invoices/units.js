/**
 * Unit normalization.
 *
 * This is the unglamorous half of the whole idea, and the place a cost tracker
 * actually dies. One supplier bills mozzarella as "5 x 2.5 KG CS", the next as
 * "CASE 25 LB", a third as "EA". Until those three become one number per
 * kilogram, every comparison between them is noise wearing the costume of a
 * finding.
 *
 * Nothing here is allowed to touch a language model. A model that quietly turns
 * pounds into kilograms the wrong way produces a confident sentence about money
 * that is wrong, and one of those costs more trust than the whole system earns.
 */

/** Everything resolves to one of three base units, or to "each". */
const CONVERSIONS = {
  kg: { base: "kg", factor: 1 },
  kgs: { base: "kg", factor: 1 },
  g: { base: "kg", factor: 0.001 },
  gr: { base: "kg", factor: 0.001 },
  lb: { base: "kg", factor: 0.45359237 },
  lbs: { base: "kg", factor: 0.45359237 },
  "#": { base: "kg", factor: 0.45359237 },
  oz: { base: "kg", factor: 0.0283495231 },
  l: { base: "l", factor: 1 },
  lt: { base: "l", factor: 1 },
  ltr: { base: "l", factor: 1 },
  litre: { base: "l", factor: 1 },
  ml: { base: "l", factor: 0.001 },
  gal: { base: "l", factor: 3.785411784 }, // US gallon: what Canadian foodservice invoices actually quote
  ea: { base: "ea", factor: 1 },
  each: { base: "ea", factor: 1 },
  ct: { base: "ea", factor: 1 },
  pc: { base: "ea", factor: 1 },
  pcs: { base: "ea", factor: 1 },
  dz: { base: "ea", factor: 12 },
  doz: { base: "ea", factor: 12 },
  dozen: { base: "ea", factor: 12 },
};

export class UnitError extends Error {}

/**
 * Parse a pack description into { count, size, unit }.
 *
 * Handles the shapes that actually turn up on BC foodservice invoices:
 *   "5 x 2.5 kg"  "6/4 L"  "CS 25 LB"  "2.5KG"  "24 ct"  "12x1L"
 *
 * Returns null rather than guessing. A pack string we cannot read must become a
 * visible gap, not a silent assumption: an unreadable pack that is quietly
 * treated as "1 each" turns a $90 case into a $90 unit price and invents a
 * crisis out of nothing.
 */
export function parsePack(text) {
  if (!text) return null;
  const s = String(text).toLowerCase().replace(/[,]/g, " ").trim();

  // "5 x 2.5 kg" / "6/4 l" / "12x1l" — a count of inner packs, each of some size.
  const multi = s.match(/(\d+(?:\.\d+)?)\s*(?:x|\/)\s*(\d+(?:\.\d+)?)\s*([a-z#]+)/);
  if (multi) {
    const unit = CONVERSIONS[multi[3]];
    if (!unit) return null;
    return { count: Number(multi[1]), size: Number(multi[2]), unit: multi[3] };
  }

  // "25 lb" / "2.5kg" / "24 ct" — a single pack of some size.
  const single = s.match(/(\d+(?:\.\d+)?)\s*([a-z#]+)/);
  if (single) {
    const unit = CONVERSIONS[single[2]];
    if (!unit) return null;
    return { count: 1, size: Number(single[1]), unit: single[2] };
  }

  return null;
}

/** How much, in base units, one case of this pack contains. */
export function packBaseQuantity(pack) {
  if (!pack) return null;
  const conv = CONVERSIONS[pack.unit];
  if (!conv) return null;
  return { quantity: pack.count * pack.size * conv.factor, base: conv.base };
}

/**
 * The number the whole layer exists to produce: cost per base unit, in cents.
 *
 * Takes the line exactly as it appears on the invoice (cases ordered, pack
 * description, line total) and returns dollars per kg / per litre / per each.
 * Throws rather than returning a wrong number, because a caller that silently
 * swallows this would publish the wrong one.
 */
export function unitCost({ cases, pack, lineTotalCents }) {
  const parsed = typeof pack === "string" ? parsePack(pack) : pack;
  if (!parsed) throw new UnitError(`unreadable pack: ${JSON.stringify(pack)}`);

  const per = packBaseQuantity(parsed);
  if (!per || !(per.quantity > 0)) throw new UnitError(`pack has no quantity: ${JSON.stringify(pack)}`);
  if (!(cases > 0)) throw new UnitError(`line has no case count`);

  const totalBase = per.quantity * cases;
  return { unitCostCents: lineTotalCents / totalBase, baseQuantity: totalBase, base: per.base };
}

export const BASE_LABEL = { kg: "kg", l: "L", ea: "each" };
