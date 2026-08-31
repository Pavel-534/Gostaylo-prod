/**
 * Stage 202.22 — Local Leader Tier thresholds (community path UX only).
 * Does NOT affect withdraw tiers (Beginner/Pro/Ambassador) or L1/L2/L3 split.
 *
 * Qualified host SSOT: `lib/referral/qualified-host-metrics.js`
 * (L1 invite + host_activation ledger OR ≥1 COMPLETED booking as partner/host).
 */

export const LEADER_TIERS = Object.freeze([
  Object.freeze({
    id: 'participant',
    order: 1,
    i18nKey: 'localLeaderTier_tier1_name',
    minQualifiedHosts: 0,
    minCompletedBookingsAsHost: 0,
    minEarnedThb: 0,
    requiresRegionAssignment: false,
  }),
  Object.freeze({
    id: 'activist',
    order: 2,
    i18nKey: 'localLeaderTier_tier2_name',
    minQualifiedHosts: 1,
    minCompletedBookingsAsHost: 0,
    minEarnedThb: 0,
    requiresRegionAssignment: false,
  }),
  Object.freeze({
    id: 'mentor',
    order: 3,
    i18nKey: 'localLeaderTier_tier3_name',
    minQualifiedHosts: 3,
    minCompletedBookingsAsHost: 1,
    minEarnedThb: 0,
    requiresRegionAssignment: false,
  }),
  Object.freeze({
    id: 'leader',
    order: 4,
    i18nKey: 'localLeaderTier_tier4_name',
    minQualifiedHosts: 10,
    minCompletedBookingsAsHost: 5,
    minEarnedThb: 1000,
    requiresRegionAssignment: false,
  }),
  Object.freeze({
    id: 'regional_leader',
    order: 5,
    i18nKey: 'localLeaderTier_tier5_name',
    minQualifiedHosts: 10,
    minCompletedBookingsAsHost: 5,
    minEarnedThb: 1000,
    requiresRegionAssignment: true,
  }),
])

/** Tailwind palette tokens for tier cards (display only). */
export const LEADER_TIER_PALETTE = Object.freeze({
  participant: Object.freeze({ bg: 'bg-slate-50', text: 'text-slate-700', accent: 'bg-slate-400' }),
  activist: Object.freeze({ bg: 'bg-emerald-50', text: 'text-emerald-700', accent: 'bg-emerald-500' }),
  mentor: Object.freeze({ bg: 'bg-blue-50', text: 'text-blue-700', accent: 'bg-blue-500' }),
  leader: Object.freeze({ bg: 'bg-violet-50', text: 'text-violet-700', accent: 'bg-violet-500' }),
  regional_leader: Object.freeze({ bg: 'bg-amber-50', text: 'text-amber-700', accent: 'bg-amber-500' }),
})

/** profiles.metadata key — set manually by admin (no auto region). */
export const LOCAL_LEADER_REGION_METADATA_KEY = 'local_leader_region_id'
