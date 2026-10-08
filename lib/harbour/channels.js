/**
 * Where Harbour & Co sells, what each channel takes, and what the menu currently
 * looks like on each one.
 *
 * Commission rates are Harbour & Co's agreements as stated for these demos, the
 * same ones the delivery reconciliation uses. They describe a fictional operator,
 * not what any app charges anyone.
 *
 * The app price policy is Harbour's own rule: app prices sit 15% above the till,
 * rounded up to the next .49 or .99, to carry the commission. Plenty of groups run
 * a rule like it. Almost none of them can tell you whether every item on every app
 * still follows it, which is what the listings below are for.
 */
import { MENU } from "./menu.js";

export const CHANNELS = [
  { id: "square", label: "Square POS", kind: "pos", feeRate: 0.025, feeLabel: "card fees", takesOrders: true },
  { id: "doordash", label: "DoorDash", kind: "app", feeRate: 0.25, feeLabel: "commission", takesOrders: true },
  { id: "ubereats", label: "Uber Eats", kind: "app", feeRate: 0.3, feeLabel: "commission", takesOrders: true },
  { id: "skip", label: "SkipTheDishes", kind: "app", feeRate: 0.2, feeLabel: "commission", takesOrders: true },
  { id: "website", label: "Website menu", kind: "display", feeRate: 0, feeLabel: "", takesOrders: false },
];

export const POLICY = {
  appMarkup: 0.15,
  // App prices end in .49 or .99, always rounded up so the markup is never short.
  appEndings: [49, 99],
  // Till prices move in quarters.
  posStepCents: 25,
  // The website shows the till price.
  websiteFollows: "square",
};

/**
 * Share of each item's weekly serves by channel, for items on the apps. Used only
 * for "if volume holds" arithmetic, and labelled as that on every page.
 */
export const CHANNEL_SHARE = { square: 0.72, doordash: 0.14, ubereats: 0.1, skip: 0.04 };

/** Which apps carry which categories. Coffee travels badly on Skip; bread stays home. */
const ON_APPS = {
  doordash: (m) => !m.roomOnly && m.id !== "americano",
  ubereats: (m) => !m.roomOnly && m.id !== "americano",
  skip: (m) => !m.roomOnly && m.category !== "Coffee",
};

/** The names each channel shows, where they differ from the till. */
const NAMES = {
  doordash: { "chicken-bowl": "Chkn Rice Bowl", "prosciutto-pizza": "Prosciutto & Arugula Pizza" },
  ubereats: { "half-chicken": "Half Chicken Plate", "pain-au-chocolat": "Pain Choc", "oat-latte": "Oat Milk Latte" },
  skip: { "avocado-toast": "Avo Toast (V)", burger: "The Harbour Burger" },
};

/**
 * Mappings a person has not confirmed yet. On a real account a model proposes each
 * one once, at setup, from the two names; a person confirms it once, and from then
 * on the match is a lookup that cannot drift between runs. Here they are prepared.
 */
const SUGGESTED = {
  ubereats: ["pain-au-chocolat"],
  skip: ["avocado-toast"],
};

/** Round up to the next price ending in one of the allowed endings. */
export function roundUpToEnding(cents, endings = POLICY.appEndings) {
  const dollars = Math.floor(cents / 100);
  for (const d of [dollars, dollars + 1]) {
    for (const e of [...endings].sort((a, b) => a - b)) {
      const c = d * 100 + e;
      if (c >= cents) return c;
    }
  }
  return (dollars + 1) * 100 + endings[endings.length - 1];
}

/** What an app should charge for a till price, by Harbour's policy. */
export const appPriceFor = (posCents) => roundUpToEnding(Math.round(posCents * (1 + POLICY.appMarkup)));

/** The till prices of three plates before the August price round. */
const BEFORE_AUGUST = { "half-chicken": 2450, "salmon-plate": 2900, burger: 2050 };

/**
 * The menu as it currently stands on each channel. Mostly in line with the policy,
 * with the drift a real group accumulates, planted on purpose and checked by the
 * self-test:
 *
 *   Uber Eats  three plates still priced from before the August till increase
 *   DoorDash   avocado toast at the till price, the markup never applied
 *   Skip       margherita $2 above policy; tofu bowl not listed at all;
 *              avocado toast under a name nobody has confirmed
 *   Website    latte still showing last year's price
 */
export function listings() {
  const out = {};
  for (const ch of CHANNELS) {
    out[ch.id] = [];
    for (const m of MENU) {
      if (ch.kind === "app" && !ON_APPS[ch.id](m)) continue;
      let cents = ch.kind === "app" ? appPriceFor(m.posCents) : m.posCents;

      if (ch.id === "ubereats" && BEFORE_AUGUST[m.id]) cents = appPriceFor(BEFORE_AUGUST[m.id]);
      if (ch.id === "doordash" && m.id === "avocado-toast") cents = m.posCents;
      if (ch.id === "skip" && m.id === "margherita") cents = appPriceFor(m.posCents) + 200;
      if (ch.id === "skip" && m.id === "tofu-bowl") continue;
      if (ch.id === "website" && m.id === "latte") cents = 550;

      out[ch.id].push({
        externalId: `${ch.id.slice(0, 2).toUpperCase()}-${m.id}`,
        name: NAMES[ch.id]?.[m.id] ?? m.name,
        itemId: m.id,
        mapping: SUGGESTED[ch.id]?.includes(m.id) ? "suggested" : "confirmed",
        cents,
      });
    }
  }
  return out;
}
