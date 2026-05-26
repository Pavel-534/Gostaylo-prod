/**
 * SSOT: понижение объявлений партнёра в поиске при contact_leak_strikes ≥ порога.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { getChatSafetySettings } from '@/lib/chat-safety-settings'

/** Сильный штраф к score (ниже обычных, featured у нарушителя не учитывается). */
export const DEFAULT_CONTACT_LEAK_SEARCH_PENALTY = 2_000_000

/**
 * @param {number} strikes
 * @param {number} strikeThreshold
 * @param {boolean} [enabled]
 * @returns {boolean}
 */
export function isPartnerSearchPenalized(strikes, strikeThreshold, enabled = true) {
  if (!enabled) return false
  const s = Number(strikes) || 0
  const t = Number(strikeThreshold) || 5
  return s >= t && t > 0
}

/**
 * @param {string[]} ownerIds
 * @returns {Promise<Map<string, number>>}
 */
export async function fetchContactLeakStrikesByOwnerIds(ownerIds) {
  const map = new Map()
  const ids = [...new Set((ownerIds || []).filter(Boolean).map(String))]
  if (!ids.length || !supabaseAdmin) return map

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, contact_leak_strikes')
    .in('id', ids)

  if (error) {
    console.warn('[partner-search-penalty] strikes fetch failed:', error.message)
    return map
  }

  for (const row of data || []) {
    map.set(String(row.id), Number(row.contact_leak_strikes) || 0)
  }
  return map
}

/**
 * Настройки штрафа в поиске из system_settings.general.chatSafety.
 * @returns {Promise<{ enabled: boolean, penaltyScore: number, strikeThreshold: number }>}
 */
export async function resolveContactLeakSearchPenaltySettings() {
  const cs = await getChatSafetySettings()
  const penaltyScore = Number(cs.searchRankPenaltyScore)
  return {
    enabled: cs.searchRankPenaltyEnabled !== false,
    penaltyScore:
      Number.isFinite(penaltyScore) && penaltyScore > 0
        ? penaltyScore
        : DEFAULT_CONTACT_LEAK_SEARCH_PENALTY,
    strikeThreshold: cs.strikeThreshold,
  }
}

/**
 * @param {string} ownerId
 * @param {Map<string, number>} strikesByOwner
 * @param {{ enabled: boolean, penaltyScore: number, strikeThreshold: number }} settings
 * @returns {number} subtract from ranking score (0 if not penalized)
 */
export function computeContactLeakSearchPenalty(ownerId, strikesByOwner, settings) {
  if (!settings.enabled || !ownerId) return 0
  const strikes = strikesByOwner.get(String(ownerId)) ?? 0
  if (!isPartnerSearchPenalized(strikes, settings.strikeThreshold, true)) return 0
  return settings.penaltyScore
}
