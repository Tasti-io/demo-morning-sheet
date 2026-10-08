/**
 * The people who work at Harbour & Co. Invented names, invented people.
 *
 * Harbour & Co is a corporation (Harbour & Co Hospitality Ltd.). That matters for
 * tips in British Columbia: a director or shareholder of a corporate employer may
 * share in a tip pool only if they regularly perform, to a substantial degree, the
 * same work as the employees who share in it (Employment Standards Act s.30.4).
 * So the owner is in this list with `kind: "director"`, and the tips demo has to
 * decide about him, out loud, the one week he works a bar shift.
 *
 * `pay` is how they are paid: hourly staff are on the clock, salaried managers are
 * not, which is how most groups decide who is in the pool by default.
 */
export const LEGAL_NAME = "Harbour & Co Hospitality Ltd.";

export const ROLES = {
  server: { label: "Server", side: "foh" },
  bartender: { label: "Bartender", side: "foh" },
  barista: { label: "Barista", side: "foh" },
  host: { label: "Host", side: "foh" },
  runner: { label: "Runner", side: "foh" },
  "sous-chef": { label: "Sous chef", side: "boh" },
  cook: { label: "Line cook", side: "boh" },
  prep: { label: "Prep cook", side: "boh" },
  dish: { label: "Dishwasher", side: "boh" },
  manager: { label: "General manager", side: "mgmt" },
  owner: { label: "Owner", side: "mgmt" },
};

const P = (id, name, site, role, pay = "hourly", extra = {}) => ({ id, name, site, role, pay, kind: "employee", ...extra });

export const STAFF = [
  // Harbour Street, the flagship room
  P("E101", "Alana Reyes", "harbour", "manager", "salary"),
  P("E102", "Maya Rossi", "harbour", "server"),
  P("E103", "Priya Sandhu", "harbour", "server"),
  P("E104", "Theo Nguyen", "harbour", "server"),
  P("E105", "Grace Kim", "harbour", "server"),
  P("E106", "Luca Bianchi", "harbour", "server"),
  P("E107", "Hana Sato", "harbour", "server"),
  P("E108", "Owen Clarke", "harbour", "bartender"),
  P("E109", "Isla Moreau", "harbour", "bartender"),
  P("E110", "Ruby Chen", "harbour", "host"),
  P("E111", "Noah Ali", "harbour", "host"),
  P("E112", "Felix Park", "harbour", "runner"),
  P("E113", "Zara Hussain", "harbour", "runner"),
  P("E114", "Marco Delgado", "harbour", "sous-chef"),
  P("E115", "Jin Watanabe", "harbour", "cook"),
  P("E116", "Sofia Petrova", "harbour", "cook"),
  P("E117", "Kofi Mensah", "harbour", "cook"),
  P("E118", "Ana Lima", "harbour", "prep"),
  P("E119", "Ravi Patel", "harbour", "dish"),
  P("E120", "Tomas Novak", "harbour", "dish"),

  // Lonsdale, the neighbourhood cafe
  P("E201", "Chloe Martin", "lonsdale", "manager", "salary"),
  P("E202", "Eli Brooks", "lonsdale", "barista"),
  P("E203", "Nina Fischer", "lonsdale", "barista"),
  P("E204", "Sam Tran", "lonsdale", "barista", "hourly", { alsoAt: ["oakridge"] }),
  P("E205", "Leah Cohen", "lonsdale", "barista"),
  P("E206", "Diego Ramos", "lonsdale", "server"),
  P("E207", "Mei Lin", "lonsdale", "cook"),
  P("E208", "Ahmed Farouk", "lonsdale", "cook"),
  P("E209", "Ben Walsh", "lonsdale", "dish"),

  // Oakridge food hall, a counter
  P("E301", "Jordan Lee", "oakridge", "barista"),
  P("E302", "Amira Haddad", "oakridge", "barista"),
  P("E303", "Kai Morgan", "oakridge", "barista"),
  P("E304", "Ivy Tremblay", "oakridge", "barista"),
  P("E305", "Pedro Alves", "oakridge", "cook"),

  // Langley, the suburban room
  P("E401", "Rachel Dubois", "langley", "manager", "salary"),
  P("E402", "Aiden Murphy", "langley", "server"),
  P("E403", "Fatima Noor", "langley", "server"),
  P("E404", "Lucas Silva", "langley", "server"),
  P("E405", "Emma Johansson", "langley", "server"),
  P("E406", "Caleb Wright", "langley", "bartender"),
  P("E407", "Yuki Tanaka", "langley", "host"),
  P("E408", "Victor Ortiz", "langley", "cook"),
  P("E409", "Lina Haddad", "langley", "cook"),
  P("E410", "George Baker", "langley", "dish"),

  // The owner, a director of the company, who works the odd shift
  { id: "E001", name: "Daniel Okafor", site: "harbour", role: "owner", pay: "owner", kind: "director" },
];

const BY_ID = new Map(STAFF.map((s) => [s.id, s]));
export const person = (id) => BY_ID.get(id) ?? null;
