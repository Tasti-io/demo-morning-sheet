/**
 * Harbour & Co, the whole fictional business in one import.
 *
 * Canonical copy lives in /Tasti.io OS/harbour-data. Each demo carries a vendored
 * copy under lib/harbour, written by harbour-data/sync.mjs together with a
 * VERSION file holding a hash of these sources. Vendored rather than installed,
 * because the demos deploy from private repos and a build that has to fetch a
 * second private repo is a build that will one day fail in front of a prospect.
 */
export * from "./group.js";
export * from "./ingredients.js";
export * from "./menu.js";
export * from "./channels.js";
export * from "./staff.js";
export * from "./rota.js";
