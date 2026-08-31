/**
 * Stage 202.22 — single DB read bundle for Local Leader engagement UX.
 */
import {
  loadQualifiedHostSets,
  countCompletedBookingsAsHost,
  countBookingsViaReferralLink,
  sumReferralEarnedThb,
  isLocalLeaderRegionAssigned,
} from '@/lib/referral/qualified-host-metrics.js'
import { computeLocalLeaderTier, progressToNextTier } from '@/lib/services/marketing/local-leader-tier.service.js'
import { computeQuestsProgress } from '@/lib/services/marketing/quest-progress.service.js'
import { getLeaderRoadmapItems } from '@/lib/services/marketing/leader-roadmap.service.js'

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {string} userId
 * @param {object | null | undefined} profileMetadata
 */
export async function buildReferralEngagementPayload(supabaseAdmin, userId, profileMetadata) {
  const uid = String(userId || '').trim()
  if (!supabaseAdmin || !uid) {
    return emptyEngagementPayload()
  }

  const regionAssigned = isLocalLeaderRegionAssigned(profileMetadata)

  const [hostSets, completedBookingsAsHost, bookingsViaRefCount, earnedThb, directInvitesRes] =
    await Promise.all([
      loadQualifiedHostSets(supabaseAdmin, uid),
      countCompletedBookingsAsHost(supabaseAdmin, uid),
      countBookingsViaReferralLink(supabaseAdmin, uid),
      sumReferralEarnedThb(supabaseAdmin, uid),
      supabaseAdmin
        .from('referral_relations')
        .select('id', { head: true, count: 'exact' })
        .eq('referrer_id', uid),
    ])

  const directInvitesCount = Math.max(0, Number(directInvitesRes?.count) || hostSets.refereeIds.length)
  const qualifiedHostsCount = hostSets.qualifiedRefereeIds.size
  const qualifiedHostsLast30d = hostSets.qualifiedLast30dRefereeIds.size

  const metrics = {
    directInvitesCount,
    qualifiedHostsCount,
    qualifiedHostsLast30d,
    bookingsViaRefCount,
    completedBookingsAsHost,
    earnedThb,
    regionAssigned,
  }

  const { current, next } = computeLocalLeaderTier(metrics)
  const progress = progressToNextTier(next, metrics)
  const quests = computeQuestsProgress(metrics)
  const roadmap = getLeaderRoadmapItems()

  return {
    tier: {
      current: {
        id: current.id,
        order: current.order,
        i18nKey: current.i18nKey,
      },
      next: next
        ? {
            id: next.id,
            order: next.order,
            i18nKey: next.i18nKey,
          }
        : null,
      progressPercent: progress.percent,
      missing: progress.missing,
    },
    metrics,
    quests,
    roadmap,
  }
}

function emptyEngagementPayload() {
  const { current, next } = computeLocalLeaderTier({})
  const progress = progressToNextTier(next, {})
  return {
    tier: {
      current: { id: current.id, order: current.order, i18nKey: current.i18nKey },
      next: next ? { id: next.id, order: next.order, i18nKey: next.i18nKey } : null,
      progressPercent: progress.percent,
      missing: progress.missing,
    },
    metrics: {
      directInvitesCount: 0,
      qualifiedHostsCount: 0,
      qualifiedHostsLast30d: 0,
      bookingsViaRefCount: 0,
      completedBookingsAsHost: 0,
      earnedThb: 0,
      regionAssigned: false,
    },
    quests: computeQuestsProgress({}),
    roadmap: getLeaderRoadmapItems(),
  }
}
