import { incidentRecencyWeight } from './constants.js'
import {
  summarizeGuestReviewRatings,
  computeReliabilityFromCounts,
  buildCriticalFactors,
  buildPathToTop,
} from './formula.js'
import {
  fetchGuestToPartnerReviewRollupForPartner,
  fetchPartnerAuthoredGuestReviewCount,
  merge12mTooltipBatch,
} from './data-provider.js'
import { computePartnerReliabilitySnapshot } from './snapshot.js'
import { trustPublicFromSnapshot } from './dto.js'
import { fetchDominantListingCategorySlugForPartner } from '@/lib/partner/partner-dominant-category'
import { fetchPartnerInstructionPhotoStats } from '@/lib/partner/partner-instruction-photo-stats'

/**
 * Partner reliability / trust (facade). Implementation: ./reputation/*.js
 */
export class ReputationService {
  static incidentRecencyWeight(iso) {
    return incidentRecencyWeight(iso)
  }

  static summarizeGuestReviewRatings = summarizeGuestReviewRatings
  static computeReliabilityFromCounts = computeReliabilityFromCounts
  static buildCriticalFactors = buildCriticalFactors
  static buildPathToTop = buildPathToTop

  static fetchGuestToPartnerReviewRollupForPartner = fetchGuestToPartnerReviewRollupForPartner
  static fetchPartnerAuthoredGuestReviewCount = fetchPartnerAuthoredGuestReviewCount

  static async computePartnerReliabilitySnapshot(partnerId) {
    return computePartnerReliabilitySnapshot(partnerId)
  }

  static async getPartnerReputationHealth(partnerId) {
    const snap = await computePartnerReliabilitySnapshot(partnerId)
    const dominantCategorySlug = await fetchDominantListingCategorySlugForPartner(partnerId)
    const instructionPhotos = await fetchPartnerInstructionPhotoStats(partnerId)
    return {
      snapshot: snap,
      criticalFactors: buildCriticalFactors(snap),
      pathToTop: buildPathToTop(snap),
      dominantCategorySlug,
      instructionPhotos,
    }
  }

  static async merge12mTooltipBatch(partnerIds, trustMap) {
    return merge12mTooltipBatch(partnerIds, trustMap)
  }

  static async getPartnerTrustPublic(partnerId) {
    const snap = await computePartnerReliabilitySnapshot(partnerId)
    const map = new Map([[String(partnerId), trustPublicFromSnapshot(snap)]])
    await merge12mTooltipBatch([partnerId], map)
    return map.get(String(partnerId))
  }

  static async getPartnersTrustPublicBatch(partnerIds) {
    const unique = [...new Set(partnerIds.filter(Boolean).map(String))].slice(0, 100)
    const map = new Map()
    await Promise.all(
      unique.map(async (id) => {
        try {
          const snap = await computePartnerReliabilitySnapshot(id)
          map.set(id, trustPublicFromSnapshot(snap))
        } catch (e) {
          console.warn('[ReputationService] batch item failed', id, e?.message)
        }
      }),
    )
    await merge12mTooltipBatch(unique, map)
    return map
  }
}

export default ReputationService
