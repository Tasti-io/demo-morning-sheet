/**
 * Harbour & Co: the fictional group every Tasti demo runs on.
 *
 * Invented on purpose. Putting a real operator's name next to invented numbers on
 * a public page would be putting words in their mouth. Kept in one place so that a
 * visitor who opens two demos sees one business, not two unrelated toys: the
 * cheese on the invoice is the cheese on the pizza is the pizza on DoorDash.
 */
export const GROUP = {
  name: "Harbour & Co",
  tagline: "Coffee, bread and a short menu. Four rooms around Vancouver.",
  address: "12 Mooring Lane, Vancouver",
  phone: "604 555 0148",
  hours: [
    ["Monday to Thursday", "7:00 to 17:00"],
    ["Friday", "7:00 to 21:00"],
    ["Saturday", "8:00 to 21:00"],
    ["Sunday", "8:00 to 16:00"],
  ],
};

/** The same four rooms as the morning sheet. Two of them sell through the apps. */
export const SITES = [
  { id: "harbour", name: "Harbour Street", format: "Flagship room, 92 seats", onApps: true },
  { id: "lonsdale", name: "Lonsdale", format: "Neighbourhood cafe, 40 seats", onApps: true },
  { id: "oakridge", name: "Oakridge food hall", format: "Counter, no seating", onApps: false },
  { id: "langley", name: "Langley", format: "Suburban room, 70 seats", onApps: false },
];

/** Invented suppliers, the same names the invoice demos use. */
export const SUPPLIERS = [
  { id: "pacific", name: "Pacific Foodservice", kind: "broadline" },
  { id: "fraser", name: "Fraser Valley Meats", kind: "protein" },
  { id: "roasters", name: "Harbour Coffee Roasters", kind: "coffee" },
  { id: "paper", name: "Lower Mainland Paper", kind: "packaging" },
];
