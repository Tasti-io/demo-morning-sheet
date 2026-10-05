/**
 * The canonical item catalog.
 *
 * Suppliers do not agree on names. Sysco's "MOZZ SHRD WHL MLK 5/2.5KG" and GFS's
 * "Cheese Mozzarella Shredded 25LB" are one ingredient with one price history, and
 * until they are joined under one id there is nothing to compare and nothing to
 * say. This file is that join.
 *
 * Where a supplier prints an item number, that number is the join key and the
 * text is only a fallback. A distributor's SKU is stable across the renames,
 * abbreviations and typos that wording goes through, so one code recorded here is
 * worth more than five aliases.
 *
 * `defaultPack` exists for the retail and cash-and-carry end, where the receipt
 * prints a price but no pack size. It is a fact a person entered once about one
 * specific item code, not an inference the system made, and every line priced that
 * way is marked as coming from the catalog rather than from the document.
 *
 * Alias matching is deterministic keyword matching, on purpose. A model gets to
 * propose a mapping for a description we have never seen (see extract.js), but the
 * proposal is written here as data and reviewed once by a human. After that the
 * match is free, repeatable, and cannot drift between runs. A mapping that a model
 * re-decides on every invoice is a price history that reorganizes itself.
 *
 * `menu` links an ingredient to the dish it lands in and to when that dish's price
 * last moved. Square's Catalog API carries both the price and its updated_at, so
 * this is a real field on real accounts, not a demo convenience. It is what turns
 * "cheese is up 18%" into "cheese is up 18% and you have not touched the pizza
 * price since February", which is the sentence that actually moves someone.
 */

export const CATALOG = [
  {
    id: "mozzarella",
    label: "Mozzarella, shredded",
    base: "kg",
    codes: [],
    aliases: ["mozz", "mozzarella"],
    menu: { item: "Margherita", priceCents: 2100, priceSetOn: "2026-02-14", basePerServe: 0.11 },
  },
  {
    id: "chicken-thigh",
    label: "Chicken thigh, boneless",
    base: "kg",
    aliases: ["chicken thigh", "chkn thgh", "thigh bnls", "chicken bnls thigh"],
    menu: { item: "Half chicken plate", priceCents: 2650, priceSetOn: "2026-05-02", basePerServe: 0.24 },
  },
  {
    id: "coffee-beans",
    label: "Espresso beans",
    base: "kg",
    aliases: ["espresso", "coffee bean", "whole bean", "beans espresso"],
    menu: { item: "Latte", priceCents: 575, priceSetOn: "2026-01-09", basePerServe: 0.018 },
  },
  {
    id: "oat-milk",
    label: "Oat milk",
    base: "l",
    aliases: ["oat milk", "oatmilk", "oat bev", "oat barista"],
    menu: null,
  },
  {
    id: "avocado",
    label: "Avocado",
    base: "ea",
    aliases: ["avocado", "avo hass", "hass"],
    menu: { item: "Avocado toast", priceCents: 1650, priceSetOn: "2026-06-20", basePerServe: 0.5 },
  },
  {
    id: "napkins",
    label: "Dispenser napkins",
    base: "ea",
    aliases: ["napkin", "serviette", "dispenser nap"],
    menu: null,
  },
  {
    // Added from a real Costco receipt. The item number is the join key; the pack
    // weight is deliberately absent, because nobody has looked at the package yet
    // and inventing it would put a made-up price per kilogram into the history.
    id: "blue-cheese",
    label: "Blue cheese",
    base: "kg",
    codes: ["5058014"],
    aliases: ["blue cheese", "bleu cheese", "gorgonzola"],
    menu: null,
  },
  {
    id: "flour",
    label: "Bread flour",
    base: "kg",
    aliases: ["flour", "bread flr", "all purpose"],
    menu: null,
  },
];

const BY_ID = new Map(CATALOG.map((c) => [c.id, c]));
export const item = (id) => BY_ID.get(id) ?? null;

const BY_CODE = new Map();
for (const entry of CATALOG) for (const code of entry.codes ?? []) BY_CODE.set(String(code), entry.id);

/**
 * Match a supplier's raw description to a canonical id.
 *
 * Longest alias wins, so "chicken thigh" beats a bare "chicken" if both were ever
 * registered. Returns null when nothing matches, and null is the useful answer: an
 * unmatched line goes to the review queue instead of being filed under whichever
 * item happened to share a word with it. Guessing here corrupts a price history
 * quietly, and a quietly corrupted price history is worse than an empty one.
 */
export function matchItem(description, code) {
  // A printed item number is an exact identifier, so it settles the question
  // before any guessing at words begins.
  if (code && BY_CODE.has(String(code).trim())) return BY_CODE.get(String(code).trim());

  if (!description) return null;
  const d = String(description).toLowerCase();

  let best = null;
  for (const entry of CATALOG) {
    for (const alias of entry.aliases) {
      if (d.includes(alias) && (!best || alias.length > best.alias.length)) {
        best = { id: entry.id, alias };
      }
    }
  }
  return best ? best.id : null;
}
