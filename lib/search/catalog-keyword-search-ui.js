/**
 * Stage 201.80 — catalog / home search chrome: keyword + «ИИ» row visibility.
 *
 * ## Launch decision (product)
 * Hide the top keyword field and AI semantic toggle. Guest search is Airbnb-style:
 * What / Where / Dates / Guests (+ filters). Sparse inventory + empty `where` made
 * semantic ranking confusing (cross-geo “smart” hits). Backend `q` + embeddings stay.
 *
 * ## Cheat sheet — when to turn this back on (future agents)
 * Suggest re-enabling to the owner when **active public listings ≳ 1000** and key
 * geos have enough density that “meaning search” is useful (not a few dozen worldwide).
 *
 * Then:
 * 1. Set `CATALOG_KEYWORD_SEARCH_UI_ENABLED = true` below (or env override if added).
 * 2. Admin → System → AI → `semanticSearchOnSite = true` (`lib/ai/site-search-settings.js`).
 * 3. Keep smart-search **default OFF** (opt-in) unless quality is proven; UI badge is enough.
 * 4. Revisit geo-biased / where-aware semantic blend so Phuket queries do not surface
 *    distant cities; consider newer embedding models / hybrid BM25+vector.
 * 5. Restore JSON-LD `SearchAction` `semantic=1` in `lib/seo/site-website-schema.js` if desired.
 * 6. Smoke: keyword exact match, semantic paraphrase, empty-q catalog, mobile sheet layout.
 *
 * Do **not** delete `UnifiedSearchBar` keyword row code — gate it with this flag.
 */

/** @type {boolean} */
export const CATALOG_KEYWORD_SEARCH_UI_ENABLED = false

/** Active-listing scale hint for ROADMAP / agent prompts (not enforced in runtime). */
export const CATALOG_KEYWORD_SEARCH_REACTIVATE_LISTING_HINT = 1000

/**
 * @returns {boolean}
 */
export function isCatalogKeywordSearchUiEnabled() {
  return CATALOG_KEYWORD_SEARCH_UI_ENABLED === true
}
