/**
 * The canonical item catalog.
 *
 * Suppliers do not agree on names. Sysco's "MOZZ SHRD WHL MLK 5/2.5KG" and GFS's
 * "Cheese Mozzarella Shredded 25LB" are one ingredient with one price history, and
 * until they are joined under one id there is nothing to compare and nothing to
 * say. This file is that join.
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
    id: "flour",
    label: "Bread flour",
    base: "kg",
    aliases: ["flour", "bread flr", "all purpose"],
    menu: null,
  },
];

const BY_ID = new Map(CATALOG.map((c) => [c.id, c]));
export const item = (id) => BY_ID.get(id) ?? null;

/**
 * Match a supplier's raw description to a canonical id.
 *
 * Longest alias wins, so "chicken thigh" beats a bare "chicken" if both were ever
 * registered. Returns null when nothing matches, and null is the useful answer: an
 * unmatched line goes to the review queue instead of being filed under whichever
 * item happened to share a word with it. Guessing here corrupts a price history
 * quietly, and a quietly corrupted price history is worse than an empty one.
 */
export function matchItem(description) {
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
