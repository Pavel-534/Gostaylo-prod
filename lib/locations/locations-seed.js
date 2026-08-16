/**
 * Стартовые локации для UI до ответа API.
 * Stage 201.82 — guest empty «Куда?» is supply-first (popular API + «Везде»).
 * Do NOT dump Phuket districts / «Другое» into the empty drawer — that was launch noise.
 * Typed suggest still uses geo_locations via location-suggest API.
 */

import { PHUKET_DISTRICTS } from '@/lib/locations/city-district-map'

export function getStaticLocationsSeed() {
  return {
    cities: [],
    districtsByCity: {},
    allDistricts: [],
  }
}

/**
 * Legacy seed (Phuket districts + Other) — keep for tests / rare offline tools.
 * Prefer inventory-backed suggest for guest discovery.
 */
export function getLegacyPhuketStaticLocationsSeed() {
  const sortedDistricts = [...PHUKET_DISTRICTS].sort()
  return {
    cities: ['Other', 'Phuket'],
    districtsByCity: {
      Phuket: sortedDistricts,
      Other: [],
    },
    allDistricts: sortedDistricts,
  }
}
