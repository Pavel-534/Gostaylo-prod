/**
 * RSC bootstrap SSOT for `/` — deduped per request via `React.cache`.
 * Stage 171.27 — categories + default featured grid for TanStack dehydrate.
 */

import { cache } from 'react'
import { fetchCategoriesSeoSnapshot } from '@/lib/seo/listings-catalog-categories-snapshot'
import { mapCategoriesFromSeoSnapshot } from '@/lib/catalog/map-categories-seo-snapshot'
import {
  buildHomeDefaultFeaturedKeyParams,
} from '@/lib/home/fetch-home-featured'
import { fetchHomeFeaturedServer } from '@/lib/home/fetch-home-featured-server'

/** Same segment as catalog bootstrap — shared `queryKeys.public.categories()` hydrate. */
export const HOME_BOOTSTRAP_DISPLAY_CURRENCY = 'THB'

/**
 * @typedef {Object} HomeBootstrapResult
 * @property {ReturnType<typeof mapCategoriesFromSeoSnapshot>} categories
 * @property {ReturnType<typeof buildHomeDefaultFeaturedKeyParams>} featuredKeyParams
 * @property {{ listings: object[], available: number }} featuredResult
 */

async function loadHomeBootstrap() {
  const categorySeoRows = await fetchCategoriesSeoSnapshot()
  const categories = mapCategoriesFromSeoSnapshot(categorySeoRows)
  const featuredKeyParams = buildHomeDefaultFeaturedKeyParams()
  const featuredResult = await fetchHomeFeaturedServer(featuredKeyParams)

  return {
    categories,
    featuredKeyParams,
    featuredResult,
  }
}

/** Cached home bootstrap — one load per RSC request (`/` page). */
export const getCachedHomeBootstrap = cache(loadHomeBootstrap)
