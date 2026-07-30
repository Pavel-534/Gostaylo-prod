/**
 * Stage 199.2 — guest-facing partner response SLA copy (pure).
 */

import {
  REPUTATION_SLA_BONUS_AVG_MAX_MINUTES,
  REPUTATION_SLA_MIN_SAMPLES_SCORE,
  REPUTATION_SLA_TOP_MAX_AVG_MINUTES,
} from '@/lib/config/reputation-sla.js'

/**
 * @param {object | null | undefined} trust — public partnerTrust DTO
 * @returns {{
 *   kind: 'minutes' | 'hours' | 'fast' | 'fallback'
 *   minutes?: number
 *   hours?: number
 *   i18nKey: string
 *   i18nParams?: Record<string, number>
 * } | null}
 */
export function resolveHostResponseSlaBadge(trust) {
  if (!trust || typeof trust !== 'object') {
    return {
      kind: 'fallback',
      i18nKey: 'listingHostSla_fallback',
    }
  }

  const avg = Number(trust.avgInitialResponseMinutes30d)
  const samples = Number(trust.initialResponseSampleCount30d) || 0

  if (!Number.isFinite(avg) || avg < 0 || samples < REPUTATION_SLA_MIN_SAMPLES_SCORE) {
    return {
      kind: 'fallback',
      i18nKey: 'listingHostSla_fallback',
    }
  }

  if (avg < 15) {
    return {
      kind: 'fast',
      minutes: Math.max(1, Math.round(avg)),
      i18nKey: 'listingHostSla_fast',
    }
  }

  if (avg <= REPUTATION_SLA_BONUS_AVG_MAX_MINUTES) {
    const minutes = Math.max(1, Math.round(avg))
    return {
      kind: 'minutes',
      minutes,
      i18nKey: 'listingHostSla_withinMinutes',
      i18nParams: { minutes },
    }
  }

  if (avg <= REPUTATION_SLA_TOP_MAX_AVG_MINUTES) {
    const minutes = Math.max(1, Math.round(avg))
    return {
      kind: 'minutes',
      minutes,
      i18nKey: 'listingHostSla_withinMinutes',
      i18nParams: { minutes },
    }
  }

  const hours = Math.max(1, Math.round(avg / 60))
  return {
    kind: 'hours',
    hours,
    minutes: Math.round(avg),
    i18nKey: 'listingHostSla_withinHours',
    i18nParams: { hours },
  }
}
