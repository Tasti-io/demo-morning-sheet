/**
 * What Harbour & Co pays per kilogram, litre or each, in cents.
 *
 * Where an item appears on the sample invoice in the invoice reader (Pacific
 * Foodservice PF-204417), this is that price, so the two demos agree to the cent.
 * The rest are invented in the same range a Vancouver kitchen pays in 2026. They
 * are the "now" prices; the morning sheet's sixteen-week history ends on them.
 */
export const INGREDIENTS = [
  // From PF-204417
  { id: "mozzarella", label: "Mozzarella, shredded", base: "kg", cents: 945, supplier: "pacific" },
  { id: "flour", label: "Bread flour", base: "kg", cents: 190, supplier: "pacific" },
  { id: "chicken-thigh", label: "Chicken thigh, boneless", base: "kg", cents: 1340, supplier: "pacific" },
  { id: "butter", label: "Butter, unsalted", base: "kg", cents: 1216, supplier: "pacific" },
  { id: "canola", label: "Canola oil", base: "l", cents: 218, supplier: "pacific" },
  { id: "tomato", label: "Crushed tomato", base: "kg", cents: 307, supplier: "pacific" },
  { id: "avocado", label: "Avocado, Hass", base: "ea", cents: 131, supplier: "pacific" },
  { id: "salmon", label: "Salmon fillet", base: "kg", cents: 2450, supplier: "pacific" },
  { id: "lemon", label: "Lemon", base: "ea", cents: 44, supplier: "pacific" },
  // Invented, same range
  { id: "coffee-beans", label: "Espresso beans", base: "kg", cents: 2850, supplier: "roasters" },
  { id: "milk", label: "Milk, 2%", base: "l", cents: 165, supplier: "pacific" },
  { id: "oat-milk", label: "Oat milk", base: "l", cents: 282, supplier: "roasters" },
  { id: "eggs", label: "Eggs, large", base: "ea", cents: 37, supplier: "pacific" },
  { id: "beef", label: "Ground beef 85/15", base: "kg", cents: 1085, supplier: "fraser" },
  { id: "prosciutto", label: "Prosciutto", base: "kg", cents: 4200, supplier: "pacific" },
  { id: "mushroom", label: "Cremini mushroom", base: "kg", cents: 880, supplier: "pacific" },
  { id: "cheddar", label: "Aged cheddar", base: "kg", cents: 1180, supplier: "pacific" },
  { id: "feta", label: "Feta", base: "kg", cents: 1450, supplier: "pacific" },
  { id: "greens", label: "Mixed greens", base: "kg", cents: 1100, supplier: "pacific" },
  { id: "arugula", label: "Arugula", base: "kg", cents: 1650, supplier: "pacific" },
  { id: "basil", label: "Basil", base: "kg", cents: 3800, supplier: "pacific" },
  { id: "potato", label: "Potato", base: "kg", cents: 160, supplier: "pacific" },
  { id: "rice", label: "Jasmine rice", base: "kg", cents: 310, supplier: "pacific" },
  { id: "tofu", label: "Tofu, firm", base: "kg", cents: 690, supplier: "pacific" },
  { id: "sesame-dressing", label: "Sesame dressing", base: "l", cents: 900, supplier: "pacific" },
  { id: "chocolate", label: "Dark chocolate", base: "kg", cents: 1600, supplier: "pacific" },
  { id: "bun", label: "Brioche bun", base: "ea", cents: 85, supplier: "pacific" },
  // Packaging, for orders that leave the building
  { id: "pizza-box", label: "Pizza box", base: "ea", cents: 62, supplier: "paper" },
  { id: "bowl-container", label: "Bowl container and lid", base: "ea", cents: 48, supplier: "paper" },
  { id: "clamshell", label: "Clamshell", base: "ea", cents: 35, supplier: "paper" },
  { id: "cup-lid", label: "Cup and lid", base: "ea", cents: 18, supplier: "paper" },
  { id: "bag", label: "Paper bag", base: "ea", cents: 12, supplier: "paper" },
];

const BY_ID = new Map(INGREDIENTS.map((i) => [i.id, i]));
export const ingredient = (id) => BY_ID.get(id) ?? null;
