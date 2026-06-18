/**
 * Stage 160 — bust location discovery caches after admin resolution.
 */

import { resetPendingLocationSuggestionsCacheForTests } from '@/lib/locations/location-pending-suggestions-cache'
import { resetGeoSynonymsCacheForTests } from '@/lib/locations/location-synonyms'

export function invalidateLocationDiscoveryCaches() {
  resetPendingLocationSuggestionsCacheForTests()
  resetGeoSynonymsCacheForTests()
}
