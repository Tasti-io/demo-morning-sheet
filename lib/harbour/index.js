/**
 * Harbour & Co, the whole fictional business in one import.
 *
 * Canonical copy lives in github.com/Tasti-io/harbour-data. Each demo carries a
 * vendored copy under lib/harbour, written by harbour-data/sync.mjs together with a
 * VERSION file holding a hash of these sources. Vendored rather than installed, so
 * a demo's build never has to fetch a second repo: a build that depends on another
 * repo is a build that will one day fail in front of a prospect.
 */
export * from "./group.js";
export * from "./ingredients.js";
export * from "./menu.js";
export * from "./channels.js";
export * from "./staff.js";
export * from "./rota.js";
