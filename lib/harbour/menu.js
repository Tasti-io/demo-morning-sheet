/**
 * Harbour & Co's menu, one price list for all four rooms.
 *
 * `posCents` is the price at the till. The four items the Avo demo shows on the
 * venue page carry the same prices here.
 *
 * `recipe` is quantity per serve in the ingredient's base unit (kg, l or each).
 * `pantryCents` covers what is too small to list per item (salt, garnish, oil for
 * the pan, the sauce made in batches) and is stated per item rather than hidden in
 * a percentage. `pack` is the packaging an order needs when it leaves the building.
 *
 * `weekly` is serves per week across the group, in the room and on the apps
 * together. It exists only to turn a price change into "if volume holds, this is
 * what it moves", which the pages label as that assumption.
 */
export const CATEGORIES = ["Pizza", "Plates", "Bowls", "Brunch", "Bakery", "Coffee"];

export const MENU = [
  { id: "margherita", name: "Margherita", category: "Pizza", posCents: 2100, weekly: 310, pantryCents: 215,
    recipe: { mozzarella: 0.16, flour: 0.22, tomato: 0.11, basil: 0.004, canola: 0.012 }, pack: ["pizza-box", "bag"] },
  { id: "prosciutto-pizza", name: "Prosciutto and arugula", category: "Pizza", posCents: 2550, weekly: 190, pantryCents: 205,
    recipe: { mozzarella: 0.14, flour: 0.22, tomato: 0.1, prosciutto: 0.05, arugula: 0.025 }, pack: ["pizza-box", "bag"] },
  { id: "mushroom-pizza", name: "Wild mushroom", category: "Pizza", posCents: 2300, weekly: 140, pantryCents: 250,
    recipe: { mozzarella: 0.15, flour: 0.22, mushroom: 0.12, butter: 0.01 }, pack: ["pizza-box", "bag"] },

  { id: "half-chicken", name: "Half chicken plate", category: "Plates", posCents: 2650, weekly: 210, pantryCents: 275, modifiers: true,
    recipe: { "chicken-thigh": 0.32, potato: 0.28, greens: 0.04, butter: 0.015, lemon: 0.25 }, pack: ["clamshell", "bag"] },
  { id: "salmon-plate", name: "Salmon plate", category: "Plates", posCents: 3100, weekly: 120, pantryCents: 425, modifiers: true,
    recipe: { salmon: 0.18, potato: 0.22, greens: 0.05, lemon: 0.25, butter: 0.02 }, pack: ["clamshell", "bag"] },
  { id: "burger", name: "Harbour burger", category: "Plates", posCents: 2200, weekly: 260, pantryCents: 285, modifiers: true,
    recipe: { beef: 0.17, bun: 1, cheddar: 0.03, potato: 0.22, canola: 0.06 }, pack: ["clamshell", "bag"] },

  { id: "chicken-bowl", name: "Chicken rice bowl", category: "Bowls", posCents: 1850, weekly: 280, pantryCents: 135,
    recipe: { "chicken-thigh": 0.16, rice: 0.12, greens: 0.05, avocado: 0.5, "sesame-dressing": 0.03 }, pack: ["bowl-container", "bag"] },
  { id: "tofu-bowl", name: "Sesame tofu bowl", category: "Bowls", posCents: 1650, weekly: 150, pantryCents: 140,
    recipe: { tofu: 0.15, rice: 0.12, greens: 0.05, avocado: 0.5, "sesame-dressing": 0.03 }, pack: ["bowl-container", "bag"] },
  { id: "salmon-bowl", name: "Salmon bowl", category: "Bowls", posCents: 2250, weekly: 130, pantryCents: 195,
    recipe: { salmon: 0.13, rice: 0.12, greens: 0.05, avocado: 0.5, "sesame-dressing": 0.03 }, pack: ["bowl-container", "bag"] },

  { id: "avocado-toast", name: "Avocado toast", category: "Brunch", posCents: 1650, weekly: 340, pantryCents: 200,
    recipe: { flour: 0.14, avocado: 1, feta: 0.03, lemon: 0.15, eggs: 1 }, pack: ["clamshell", "bag"] },
  { id: "eggs-on-toast", name: "Eggs on toast", category: "Brunch", posCents: 1450, weekly: 220, pantryCents: 200,
    recipe: { flour: 0.14, eggs: 2, butter: 0.02, greens: 0.02 }, pack: ["clamshell", "bag"] },
  { id: "breakfast-sandwich", name: "Breakfast sandwich", category: "Brunch", posCents: 1350, weekly: 290, pantryCents: 90,
    recipe: { bun: 1, eggs: 2, cheddar: 0.025, prosciutto: 0.02 }, pack: ["clamshell", "bag"] },

  { id: "croissant", name: "Butter croissant", category: "Bakery", posCents: 475, weekly: 620, pantryCents: 40,
    recipe: { flour: 0.06, butter: 0.035 }, pack: ["bag"] },
  { id: "pain-au-chocolat", name: "Pain au chocolat", category: "Bakery", posCents: 525, weekly: 410, pantryCents: 40,
    recipe: { flour: 0.06, butter: 0.035, chocolate: 0.015 }, pack: ["bag"] },
  { id: "sourdough-loaf", name: "Sourdough loaf", category: "Bakery", posCents: 1100, weekly: 180, pantryCents: 70,
    recipe: { flour: 0.55 }, pack: ["bag"], roomOnly: true },

  { id: "latte", name: "Latte", category: "Coffee", posCents: 575, weekly: 1450, pantryCents: 15,
    recipe: { "coffee-beans": 0.018, milk: 0.26 }, pack: ["cup-lid"] },
  { id: "oat-latte", name: "Oat latte", category: "Coffee", posCents: 650, weekly: 520, pantryCents: 20,
    recipe: { "coffee-beans": 0.018, "oat-milk": 0.26 }, pack: ["cup-lid"] },
  { id: "americano", name: "Americano", category: "Coffee", posCents: 425, weekly: 680, pantryCents: 10,
    recipe: { "coffee-beans": 0.018 }, pack: ["cup-lid"] },
  { id: "cold-brew", name: "Cold brew", category: "Coffee", posCents: 550, weekly: 360, pantryCents: 15,
    recipe: { "coffee-beans": 0.03 }, pack: ["cup-lid"] },
];

const BY_ID = new Map(MENU.map((m) => [m.id, m]));
export const menuItem = (id) => BY_ID.get(id) ?? null;
