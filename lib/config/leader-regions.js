/**
 * Stage 202.23 — starter list for Local Leader regional assignment.
 * Admin-only metadata flag: `profiles.metadata.local_leader_region_id`.
 */

export const LEADER_REGIONS = Object.freeze([
  Object.freeze({ id: 'phuket', i18nKey: 'leaderRegions_phuket' }),
  Object.freeze({ id: 'pattaya', i18nKey: 'leaderRegions_pattaya' }),
  Object.freeze({ id: 'bangkok', i18nKey: 'leaderRegions_bangkok' }),
  Object.freeze({ id: 'samui', i18nKey: 'leaderRegions_samui' }),
  Object.freeze({ id: 'moscow', i18nKey: 'leaderRegions_moscow' }),
  Object.freeze({ id: 'spb', i18nKey: 'leaderRegions_spb' }),
  Object.freeze({ id: 'sochi', i18nKey: 'leaderRegions_sochi' }),
  Object.freeze({ id: 'krasnoyarsk', i18nKey: 'leaderRegions_krasnoyarsk' }),
  Object.freeze({ id: 'irkutsk', i18nKey: 'leaderRegions_irkutsk' }),
  Object.freeze({ id: 'vladivostok', i18nKey: 'leaderRegions_vladivostok' }),
  Object.freeze({ id: 'chita', i18nKey: 'leaderRegions_chita' }),
  Object.freeze({ id: 'ulan_ude', i18nKey: 'leaderRegions_ulan_ude' }),
])

export function isValidRegionId(id) {
  const value = String(id || '').trim()
  if (!value) return false
  return LEADER_REGIONS.some((row) => row.id === value)
}

