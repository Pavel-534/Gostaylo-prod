import { REPUTATION_SLA_MIN_SAMPLES_SCORE } from '@/lib/config/reputation-sla'

/** Min completed stays before "ultra reliable" completion % is shown */
const RENTER_TRUST_MIN_COMPLETION_SAMPLES = 3

/**
 * Renter-facing trust chips derived from `partner_trust` / reputation-health public DTO.
 * @param {object | null | undefined} trust
 * @returns {('lightning_response' | 'ultra_reliable')[]}
 */
export function getRenterTrustBadgeKinds(trust) {
  if (!trust || typeof trust !== 'object') return []

  const kinds = []
  const avg = trust.avgInitialResponseMinutes30d
  const nResp = Number(trust.initialResponseSampleCount30d) || 0
  if (avg != null && Number.isFinite(avg) && avg < 15 && nResp >= REPUTATION_SLA_MIN_SAMPLES_SCORE) {
    kinds.push('lightning_response')
  }

  const completed = Number(trust.completedStays) || 0
  const clean = Number(trust.cleanStays) || 0
  const pctFromDto = trust.completionCleanPercent
  const pct =
    pctFromDto != null && Number.isFinite(Number(pctFromDto))
      ? Number(pctFromDto)
      : completed > 0
        ? (100 * clean) / completed
        : null
  if (pct != null && pct > 98 && completed >= RENTER_TRUST_MIN_COMPLETION_SAMPLES) {
    kinds.push('ultra_reliable')
  }

  return kinds
}
