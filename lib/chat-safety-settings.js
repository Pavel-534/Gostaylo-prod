/**
 * Настройки безопасности чата из system_settings.general.chatSafety
 */

import { readSystemSettingValue } from '@/lib/admin/system-settings-store'

const DEFAULTS = {
  autoShadowbanEnabled: false,
  strikeThreshold: 5,
  estimatedBookingValueThb: 8000,
  searchRankPenaltyEnabled: true,
  searchRankPenaltyScore: 2_000_000,
}

function clampInt(n, min, max, fallback) {
  const v = parseInt(String(n), 10)
  if (!Number.isFinite(v)) return fallback
  return Math.min(max, Math.max(min, v))
}

function clampPositiveNumber(n, fallback) {
  const v = parseFloat(String(n))
  if (!Number.isFinite(v) || v < 0) return fallback
  return v
}

/**
 * @returns {Promise<{ autoShadowbanEnabled: boolean, strikeThreshold: number, estimatedBookingValueThb: number }>}
 */
export async function getChatSafetySettings() {
  const general = (await readSystemSettingValue('general')) || {}
  const cs = general?.chatSafety
  if (!cs || typeof cs !== 'object') {
    return { ...DEFAULTS }
  }
  const penaltyScore = parseFloat(String(cs.searchRankPenaltyScore ?? ''))
  return {
    autoShadowbanEnabled: cs.autoShadowbanEnabled === true,
    strikeThreshold: clampInt(cs.strikeThreshold, 1, 999, DEFAULTS.strikeThreshold),
    estimatedBookingValueThb: clampPositiveNumber(
      cs.estimatedBookingValueThb,
      DEFAULTS.estimatedBookingValueThb,
    ),
    searchRankPenaltyEnabled: cs.searchRankPenaltyEnabled !== false,
    searchRankPenaltyScore:
      Number.isFinite(penaltyScore) && penaltyScore > 0
        ? penaltyScore
        : DEFAULTS.searchRankPenaltyScore,
  }
}
