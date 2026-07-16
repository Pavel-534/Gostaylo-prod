/**
 * Shared TanStack Query timing for listing detail — safe for client + server imports.
 * Stage 171.24 — extracted from prefetch module to avoid pulling server bootstrap into client bundle.
 */

/** @type {number} milliseconds — matches catalog prefetch and RSC dehydrate. */
export const LISTING_DETAIL_STALE_MS = 5 * 60 * 1000
