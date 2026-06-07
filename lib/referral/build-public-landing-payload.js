/**
 * Stage 114.3 — публичный payload для `/u/[id]` (landing-meta API).
 * Только агрегаты; без PII рефералов.
 */
import { formatPrivacyDisplayName } from '@/lib/utils/name-formatter'
import { buildAmbassadorLandingUrl, ambassadorLandingShortLabel } from '@/lib/referral/public-landing-url'
import { getSiteDisplayName, getPublicSiteUrl } from '@/lib/site-url'
import ReferralPnlService from '@/lib/services/marketing/referral-pnl.service'
import { PricingService } from '@/lib/services/pricing.service'
import { buildReferralGamificationForUser } from '@/lib/referral/build-referral-gamification-for-user'
import { resolveReferralStatsTimeZone } from '@/lib/referral/resolve-referral-stats-timezone'
import { yearMonthKeyInTimeZone, currentYearMonthKeyInTimeZone } from '@/lib/referral/tz-year-month'

function round2(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

/**
 * @param {*} supabaseAdmin
 * @param {string} userId
 */
export async function buildPublicLandingPayload(supabaseAdmin, userId) {
  const uid = String(userId || '').trim()
  if (!supabaseAdmin || !uid) throw new Error('INVALID_LANDING_PAYLOAD_INPUT')

  const { data: rc } = await supabaseAdmin
    .from('referral_codes')
    .select('code, is_active')
    .eq('user_id', uid)
    .maybeSingle()

  const code = rc?.is_active !== false && rc?.code ? String(rc.code).trim().toUpperCase() : null

  const { data: p } = await supabaseAdmin
    .from('profiles')
    .select(
      'id, first_name, last_name, referral_tier_name, referral_tier_id, referral_tier_payout_ratio, avatar_url, created_at, language, preferred_language',
    )
    .eq('id', uid)
    .maybeSingle()

  if (!p?.id) return null

  const { count: invitedCount } = await supabaseAdmin
    .from('referral_relations')
    .select('id', { head: true, count: 'exact' })
    .eq('referrer_id', uid)

  const friendsInvited = Number(invitedCount || 0)
  const directPartnersInvited = Number((await ReferralPnlService.countDirectPartnersInvited(uid)) || 0)

  const tiers = await ReferralPnlService.getReferralTiers()
  const tierState = ReferralPnlService.resolveTierForPartnerCount(tiers, directPartnersInvited)
  const currentTier = tierState.currentTier
  const nextTier = tierState.nextTier
  const currentTierFloor = Number(currentTier?.minPartnersInvited || 0)
  const tierSpan = Math.max(1, Number(nextTier?.minPartnersInvited || currentTierFloor + 1) - currentTierFloor)
  const tierProgressPercent = Math.min(
    100,
    Math.max(0, Math.round(((directPartnersInvited - currentTierFloor) / tierSpan) * 100)),
  )

  const statsTz = resolveReferralStatsTimeZone(p)
  const currentYm = currentYearMonthKeyInTimeZone(statsTz)
  let totalEarnedThb = 0
  let monthlyEarnedThb = 0

  const { data: earnedRows } = await supabaseAdmin
    .from('referral_ledger')
    .select('amount_thb, earned_at, updated_at')
    .eq('referrer_id', uid)
    .eq('status', 'earned')

  for (const row of earnedRows || []) {
    const amt = round2(row?.amount_thb)
    totalEarnedThb += amt
    const iso = row?.earned_at || row?.updated_at
    if (iso && yearMonthKeyInTimeZone(iso, statsTz) === currentYm) monthlyEarnedThb += amt
  }
  totalEarnedThb = round2(totalEarnedThb)
  monthlyEarnedThb = round2(monthlyEarnedThb)

  const general = await PricingService.getGeneralPricingSettings()
  const welcomeBonusThb = round2(
    Math.min(1_000_000, Math.max(0, Number(general?.welcome_bonus_amount ?? general?.welcomeBonusAmount ?? 500))),
  )
  const referralReinvestmentPercent = Math.min(
    95,
    Math.max(0, Number(general?.referral_reinvestment_percent ?? general?.referralReinvestmentPercent ?? 70)),
  )
  const referralSplitRatioRaw = Number(general?.referral_split_ratio ?? general?.referralSplitRatio ?? 0.5)
  const referralSplitRatio = Number.isFinite(referralSplitRatioRaw)
    ? Math.min(1, Math.max(0, referralSplitRatioRaw))
    : 0.5

  const baseUrl = getPublicSiteUrl()
  const joinUrl = code ? `${baseUrl}/?ref=${encodeURIComponent(code)}` : baseUrl || '/'

  const tiersAsc = Array.isArray(tiers)
    ? [...tiers].sort((a, b) => Number(a?.minPartnersInvited || 0) - Number(b?.minPartnersInvited || 0))
    : []
  const ambassadorLevels = tiersAsc.slice(0, 3).map((tier, idx) => ({
    level: idx + 1,
    id: tier.id,
    name: tier.name,
    minPartnersInvited: Number(tier.minPartnersInvited || 0),
    payoutRatio: tier.payoutRatio,
    unlocked: directPartnersInvited >= Number(tier.minPartnersInvited || 0),
    isCurrent:
      String(tier.id) === String(currentTier?.id) ||
      String(tier.name) === String(p.referral_tier_name || currentTier?.name),
  }))

  let publicGamification = { badgesEarned: [], primaryBadge: null }
  try {
    const gam = await buildReferralGamificationForUser(supabaseAdmin, p, {
      monthlyNetworkEarnedThb: 0,
      friendsInvited,
      totalLifetimeEarnedThb: totalEarnedThb,
    })
    publicGamification = {
      badgesEarned: gam.badgesEarned || [],
      primaryBadge: gam.primaryBadge,
    }
  } catch {
    /* optional */
  }

  const tierLabel = String(p.referral_tier_name || currentTier?.name || '').trim()

  return {
    userId: uid,
    referralCode: code,
    displayName: formatPrivacyDisplayName(p.first_name, p.last_name),
    tierLabel,
    badgeLabel: tierLabel || 'Ambassador',
    avatarUrl: p.avatar_url || null,
    landingUrl: buildAmbassadorLandingUrl(uid),
    landingShortLabel: ambassadorLandingShortLabel(uid),
    joinUrl,
    siteDisplayName: getSiteDisplayName(),
    friendsInvited,
    directPartnersInvited,
    totalEarnedThb,
    monthlyEarnedThb,
    tierProgressPercent,
    remainingToNextTier: Math.max(
      0,
      Number(nextTier?.minPartnersInvited || 0) - directPartnersInvited,
    ),
    ambassador: {
      currentTierName: tierLabel || currentTier?.name || 'Ambassador',
      nextTierName: nextTier?.name || null,
      directPartnersInvited,
      tierProgressPercent,
      levels: ambassadorLevels,
    },
    referralEstimator: {
      welcomeBonusThb,
      referralReinvestmentPercent,
      referralSplitRatio,
    },
    publicGamification,
    isAmbassador: Boolean(code),
  }
}
