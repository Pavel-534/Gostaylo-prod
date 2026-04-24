/**
 * Stage 30.0 — единое обогащение броней публичным `partner_trust` (ReputationService).
 * Любой список/строка с `partner_id` или `partnerId` получает одинаковый DTO.
 */

import { ReputationService } from '@/lib/services/reputation.service'

/**
 * @template T
 * @param {T[]} rows
 * @returns {Promise<(T & { partner_trust: object | null })[]>}
 */
export async function attachPartnerTrustToBookings(rows) {
  if (!rows?.length) return rows || []
  const partnerIds = [
    ...new Set(
      rows
        .map((b) => b?.partner_id ?? b?.partnerId)
        .filter(Boolean)
        .map(String),
    ),
  ].slice(0, 100)
  if (!partnerIds.length) {
    return rows.map((b) => ({ ...b, partner_trust: b?.partner_trust ?? null }))
  }
  const trustMap = await ReputationService.getPartnersTrustPublicBatch(partnerIds)
  return rows.map((b) => {
    const pid = b?.partner_id ?? b?.partnerId
    const key = pid != null ? String(pid) : ''
    return {
      ...b,
      partner_trust: key ? trustMap.get(key) ?? null : null,
    }
  })
}
