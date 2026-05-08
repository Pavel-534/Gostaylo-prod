import { supabaseAdmin } from '@/lib/supabase'

const TIER_DOWNGRADE_GRACE_DAYS = 30

const DEFAULT_REFERRAL_TIERS = Object.freeze([
  {
    id: 'tier-beginner',
    name: 'Beginner',
    minPartnersInvited: 0,
    payoutRatio: 60,
    description: '0+ partners invited',
  },
  {
    id: 'tier-pro',
    name: 'Pro',
    minPartnersInvited: 5,
    payoutRatio: 75,
    description: '5+ partners invited',
  },
  {
    id: 'tier-ambassador',
    name: 'Ambassador',
    minPartnersInvited: 20,
    payoutRatio: 85,
    description: '20+ partners invited',
  },
])

function clamp(value, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

export class ReferralTierSyncService {
  static normalizeTierRow(row) {
    return {
      id: String(row?.id || ''),
      name: String(row?.name || ''),
      minPartnersInvited: Math.max(0, Number(row?.min_partners_invited ?? row?.minPartnersInvited ?? 0) || 0),
      payoutRatio: clamp(Number(row?.payout_ratio ?? row?.payoutRatio ?? 0), 0, 100),
      description: String(row?.description || ''),
    }
  }

  static async getReferralTiers() {
    const { data, error } = await supabaseAdmin
      .from('referral_tiers')
      .select('id,name,min_partners_invited,payout_ratio,description')
      .order('min_partners_invited', { ascending: true })
    if (error) {
      const msg = String(error?.message || '')
      if (/relation .*referral_tiers|does not exist/i.test(msg)) {
        return [...DEFAULT_REFERRAL_TIERS]
      }
      throw new Error(error.message || 'REFERRAL_TIERS_READ_FAILED')
    }
    const rows = Array.isArray(data) ? data.map((row) => this.normalizeTierRow(row)) : []
    if (rows.length > 0) return rows
    return [...DEFAULT_REFERRAL_TIERS]
  }

  static tierRankIndex(tiers, tierId) {
    const id = String(tierId || '').trim()
    const sorted = [...(tiers || DEFAULT_REFERRAL_TIERS)]
      .map((row) => this.normalizeTierRow(row))
      .sort((a, b) => a.minPartnersInvited - b.minPartnersInvited || a.id.localeCompare(b.id))
    const idx = sorted.findIndex((t) => t.id === id)
    return idx >= 0 ? idx : 0
  }

  static resolveTierForPartnerCount(tiers, partnersInvitedCount) {
    const count = Math.max(0, Number(partnersInvitedCount) || 0)
    const sorted = [...(tiers || DEFAULT_REFERRAL_TIERS)]
      .map((row) => this.normalizeTierRow(row))
      .sort((a, b) => a.minPartnersInvited - b.minPartnersInvited)
    let current = sorted[0] || this.normalizeTierRow(DEFAULT_REFERRAL_TIERS[0])
    let next = null
    for (const tier of sorted) {
      if (count >= tier.minPartnersInvited) {
        current = tier
      } else if (!next) {
        next = tier
      }
    }
    return { currentTier: current, nextTier: next, partnersInvitedCount: count, tiers: sorted }
  }

  static async countDirectPartnersInvited(referrerId) {
    const uid = String(referrerId || '').trim()
    if (!uid) return 0
    const { data, error } = await supabaseAdmin
      .from('referral_relations')
      .select('referee_id')
      .eq('referrer_id', uid)
    if (error) throw new Error(error.message || 'REFERRAL_RELATIONS_READ_FAILED')
    const refereeIds = [...new Set((data || []).map((row) => String(row?.referee_id || '')).filter(Boolean))]
    if (refereeIds.length === 0) return 0
    const { data: profiles, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id,role')
      .in('id', refereeIds)
    if (profileErr) throw new Error(profileErr.message || 'REFERRAL_PARTNER_COUNT_FAILED')
    return (profiles || []).filter((profile) => String(profile?.role || '').toUpperCase() === 'PARTNER').length
  }

  static async syncAmbassadorTierForUser(userId, context = {}) {
    const uid = String(userId || '').trim()
    if (!uid) return { success: false, skipped: true, reason: 'USER_ID_REQUIRED' }
    const [tiers, partnersInvitedCount] = await Promise.all([
      this.getReferralTiers(),
      this.countDirectPartnersInvited(uid),
    ])
    const resolved = this.resolveTierForPartnerCount(tiers, partnersInvitedCount)
    const naturalTier = resolved.currentTier
    if (!naturalTier?.id) {
      return { success: false, skipped: true, reason: 'TIER_NOT_RESOLVED' }
    }

    let profile
    const profileSelect =
      'id,referral_tier_id,referral_tier_name,referral_tier_payout_ratio,referral_tier_grace_until'
    let profileRes = await supabaseAdmin.from('profiles').select(profileSelect).eq('id', uid).maybeSingle()
    if (profileRes.error && /referral_tier_grace_until|column/i.test(String(profileRes.error.message || ''))) {
      profileRes = await supabaseAdmin
        .from('profiles')
        .select('id,referral_tier_id,referral_tier_name,referral_tier_payout_ratio')
        .eq('id', uid)
        .maybeSingle()
    }
    const profileErr = profileRes.error
    profile = profileRes.data
    if (profileErr) throw new Error(profileErr.message || 'PROFILE_READ_FAILED')
    if (!profile?.id) return { success: false, skipped: true, reason: 'PROFILE_NOT_FOUND' }

    const storedTierId = String(profile.referral_tier_id || naturalTier.id).trim()
    const naturalRank = this.tierRankIndex(tiers, naturalTier.id)
    const storedRank = this.tierRankIndex(tiers, storedTierId)

    const nowIso = new Date().toISOString()
    const nowMs = Date.now()
    const graceUntilIso = profile.referral_tier_grace_until ? String(profile.referral_tier_grace_until) : null
    const graceMs = graceUntilIso ? new Date(graceUntilIso).getTime() : NaN
    const graceActive = Number.isFinite(graceMs) && graceMs > nowMs

    const partnerCount = Math.max(0, Number(partnersInvitedCount) || 0)
    const activityPatch = {
      referral_tier_partner_count: partnerCount,
      referral_tier_updated_at: nowIso,
      ambassador_last_activity_at: nowIso,
    }

    if (naturalRank >= storedRank) {
      const tierChanged = storedTierId !== String(naturalTier.id)
      const patch = {
        ...activityPatch,
        referral_tier_id: String(naturalTier.id),
        referral_tier_name: String(naturalTier.name),
        referral_tier_payout_ratio: clamp(Number(naturalTier.payoutRatio), 0, 100),
        referral_tier_grace_until: null,
      }
      if (tierChanged) {
        patch.referral_tier_upgraded_at = nowIso
        patch.referral_tier_meta = {
          trigger: String(context?.trigger || 'tier_sync'),
          bookingId: context?.bookingId ? String(context.bookingId) : null,
          refereeId: context?.refereeId ? String(context.refereeId) : null,
          previousTierId: storedTierId || null,
          graceCleared: true,
        }
      }
      const { error: updateErr } = await supabaseAdmin.from('profiles').update(patch).eq('id', uid)
      if (updateErr) throw new Error(updateErr.message || 'PROFILE_TIER_UPDATE_FAILED')
      return {
        success: true,
        tierChanged,
        downgradeDeferred: false,
        graceProtected: false,
        partnersInvitedCount: partnerCount,
        currentTier: naturalTier,
        nextTier: resolved.nextTier,
      }
    }

    if (graceActive) {
      const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update(activityPatch)
        .eq('id', uid)
      if (updateErr) throw new Error(updateErr.message || 'PROFILE_TIER_UPDATE_FAILED')
      return {
        success: true,
        tierChanged: false,
        downgradeDeferred: true,
        graceProtected: true,
        graceUntil: graceUntilIso,
        partnersInvitedCount: partnerCount,
        currentTier: this.normalizeTierRow(tiers.find((t) => t.id === storedTierId) || naturalTier),
        nextTier: resolved.nextTier,
      }
    }

    if (!graceUntilIso) {
      const graceEnd = new Date(nowMs + TIER_DOWNGRADE_GRACE_DAYS * 86400000).toISOString()
      const deferredPatch = {
        ...activityPatch,
        referral_tier_grace_until: graceEnd,
        referral_tier_meta: {
          trigger: String(context?.trigger || 'tier_sync'),
          downgradeGraceStarted: true,
          naturalTierId: naturalTier.id,
          storedTierId,
          bookingId: context?.bookingId ? String(context.bookingId) : null,
        },
      }
      const { error: deferErr } = await supabaseAdmin.from('profiles').update(deferredPatch).eq('id', uid)
      if (deferErr) throw new Error(deferErr.message || 'PROFILE_TIER_GRACE_FAILED')
      return {
        success: true,
        tierChanged: false,
        downgradeDeferred: true,
        graceProtected: true,
        graceStarted: true,
        graceUntil: graceEnd,
        partnersInvitedCount: partnerCount,
        currentTier: this.normalizeTierRow(tiers.find((t) => t.id === storedTierId) || naturalTier),
        nextTier: resolved.nextTier,
      }
    }

    if (graceUntilIso && !graceActive) {
      const tierChanged = storedTierId !== String(naturalTier.id)
      const downgradePatch = {
        ...activityPatch,
        referral_tier_id: String(naturalTier.id),
        referral_tier_name: String(naturalTier.name),
        referral_tier_payout_ratio: clamp(Number(naturalTier.payoutRatio), 0, 100),
        referral_tier_grace_until: null,
      }
      if (tierChanged) {
        downgradePatch.referral_tier_meta = {
          trigger: String(context?.trigger || 'tier_sync'),
          downgradeApplied: true,
          previousTierId: storedTierId || null,
          bookingId: context?.bookingId ? String(context.bookingId) : null,
        }
      }
      const { error: downErr } = await supabaseAdmin.from('profiles').update(downgradePatch).eq('id', uid)
      if (downErr) throw new Error(downErr.message || 'PROFILE_TIER_DOWNGRADE_FAILED')
      return {
        success: true,
        tierChanged,
        downgradeDeferred: false,
        graceProtected: false,
        partnersInvitedCount: partnerCount,
        currentTier: naturalTier,
        nextTier: resolved.nextTier,
      }
    }

    return {
      success: true,
      tierChanged: false,
      partnersInvitedCount: partnerCount,
      currentTier: naturalTier,
      nextTier: resolved.nextTier,
    }
  }
}

export default ReferralTierSyncService
