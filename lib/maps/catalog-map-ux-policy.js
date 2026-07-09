/**
 * Stage 177.6 - catalog mobile map UX policy (SSOT).
 */

/** Compact rail card width in mobile map sheet (px) — horizontal chip layout. */
export const CATALOG_MAP_MOBILE_RAIL_CARD_WIDTH = 220

/** Compact rail card height (px) — docked below map, not overlay. */
export const CATALOG_MAP_MOBILE_RAIL_CARD_HEIGHT = 76

/** Leaflet selection fly animation duration (ms). */
export const CATALOG_MAP_SELECT_FLY_DURATION_MS = 400

/** Minimum zoom after selecting listing from map/card sync. */
export const CATALOG_MAP_SELECT_MIN_ZOOM = 14

/** Debounce for viewport bbox emission after pan/zoom settles (ms). */
export const CATALOG_MAP_BBOX_EMIT_DEBOUNCE_MS = 400

/** Network budget guard: minimum interval between bbox fetch triggers (ms). */
export const CATALOG_MAP_BBOX_MIN_FETCH_INTERVAL_MS = 700
