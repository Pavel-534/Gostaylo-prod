/**
 * Stage 131.7 — centralized referral fraud gate (accrual / payout profile / withdrawal).
 *
 * Call sites:
 * - ReferralLedgerService.markPendingAsEarned — per-row before earned/earned_held
 * - ReferralLedgerService.creditWalletFromEarnedRows — defense before addFunds
 * - ReferralLedgerService.unlockHeldRowsForBooking — skip fraud_gate_hold rows
 * - ReferralPayoutService.distributeHostPartnerActivation — before wallet credit
 * - referral-withdrawal-guard.assertReferralWithdrawalAllowed
 * - referral-payout-profile.service + partner payout-profiles POST/PUT
 */
import { supabaseAdmin } from '@/lib/supabase'
import { computePayoutFingerprint } from '@/lib/referral/payout-profile-fingerprint.js'
import { detectPaymentInstrumentCollision } from '@/lib/referral/payment-instrument-fingerprint.js'
import { ReferralGuardService } from '@/lib/services/marketing/referral-guard.service.js'
import { makeId } from '@/lib/services/marketing/referral-calculation.js'
import { beneficiaryIdForLedgerRow } from '@/lib/services/marketing/referral-hold.service.js'
import { recordCriticalSignal } from '@/lib/critical-telemetry.js'

const REFERRER_BONUS = 'bonus'

function round2(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

/**
 * @param {string[]} userIds
 */
export async function hasOpenFraudQueueForUsers(userIds) {
  const ids = [...new Set((userIds || []).map((x) => String(x || '').trim()).filter(Boolean))]
  if (!ids.length) return { open: false, matches: [] }

  try {
    const { data, error } = await supabaseAdmin
      .from('referral_fraud_queue')
      .select('id,status,severity,referrer_id,candidate_user_id')
      .in('status', ['open'])
      .limit(50)
    if (error) {
      if (/does not exist/i.test(String(error.message || ''))) return { open: false, matches: [] }
      throw error
    }
    const matches = (data || []).filter((row) => {
      const rid = String(row.referrer_id || '')
      const cid = String(row.candidate_user_id || '')
      return ids.some((id) => id === rid || id === cid)
    })
    return { open: matches.length > 0, matches }
  } catch {
    return { open: false, matches: [] }
  }
}

/**
 * @param {string | null | undefined} userId
 */
export async function isReferralPayoutBlocked(userId) {
  const uid = String(userId || '').trim()
  if (!uid) return false
  const { data } = await supabaseAdmin.from('profiles').select('metadata').eq('id', uid).maybeSingle()
  return data?.metadata?.referral_payout_blocked === true
}

/**
 * @param {string} userId
 * @param {boolean} blocked
 * @param {string} [reason]
 */
export async function setReferralPayoutBlocked(userId, blocked, reason = '') {
  const uid = String(userId || '').trim()
  if (!uid) return
  const { data } = await supabaseAdmin.from('profiles').select('metadata').eq('id', uid).maybeSingle()
  const prev = data?.metadata && typeof data.metadata === 'object' ? { ...data.metadata } : {}
  const next = { ...prev }
  if (blocked) {
    next.referral_payout_blocked = true
    next.referral_payout_blocked_at = new Date().toISOString()
    if (reason) next.referral_payout_blocked_reason = String(reason).slice(0, 200)
  } else {
    delete next.referral_payout_blocked
    delete next.referral_payout_blocked_at
    delete next.referral_payout_blocked_reason
  }
  await supabaseAdmin.from('profiles').update({ metadata: next }).eq('id', uid)
}

/**
 * @param {string | null | undefined} fingerprint
 * @param {string | null | undefined} excludePartnerId
 */
export async function findPayoutFingerprintCollision(fingerprint, excludePartnerId = null) {
  const fp = String(fingerprint || '').trim()
  if (!fp) return null
  const exclude = String(excludePartnerId || '').trim()

  let q = supabaseAdmin
    .from('partner_payout_profiles')
    .select('id,partner_id,payout_fingerprint,is_verified')
    .eq('payout_fingerprint', fp)
    .limit(5)
  const { data, error } = await q
  if (error) {
    if (/payout_fingerprint|does not exist/i.test(String(error.message || ''))) {
      const { data: metaRows } = await supabaseAdmin
        .from('partner_payout_profiles')
        .select('id,partner_id,data,is_verified')
        .limit(500)
      const hit = (metaRows || []).find((row) => {
        if (exclude && String(row.partner_id) === exclude) return false
        return computePayoutFingerprint(row.data) === fp
      })
      return hit || null
    }
    throw error
  }
  return (data || []).find((row) => !exclude || String(row.partner_id) !== exclude) || null
}

/**
 * Device / IP overlap between referrer and referee in the referral graph.
 * @param {string} referrerId
 * @param {string} refereeId
 */
export async function detectReferralGraphOverlap(referrerId, refereeId) {
  const rid = String(referrerId || '').trim()
  const fid = String(refereeId || '').trim()
  const rules = []
  if (!rid || !fid || rid === fid) {
    return { overlap: true, rules: ['SELF_REFERRAL_PAIR'] }
  }

  const { data: relation } = await supabaseAdmin
    .from('referral_relations')
    .select('metadata,referrer_id,referee_id')
    .eq('referee_id', fid)
    .maybeSingle()

  const relMeta = relation?.metadata && typeof relation.metadata === 'object' ? relation.metadata : {}
  const relFp = String(relMeta.device_fingerprint || relMeta.device_hash || '').trim()
  const relIp = String(relMeta.ip_token || relMeta.ip_hash || '').trim()

  const { data: refAttributions } = await supabaseAdmin
    .from('referral_attributions')
    .select('device_hash,ip_hash,metadata,referrer_id')
    .eq('referrer_id', rid)
    .order('created_at', { ascending: false })
    .limit(20)

  const { data: refereeAttributions } = await supabaseAdmin
    .from('referral_attributions')
    .select('device_hash,ip_hash,metadata,converted_profile_id')
    .eq('converted_profile_id', fid)
    .order('created_at', { ascending: false })
    .limit(20)

  const referrerDevices = new Set(
    (refAttributions || [])
      .map((a) => String(a.device_hash || '').trim())
      .filter(Boolean),
  )
  const refereeDevices = new Set(
    (refereeAttributions || [])
      .map((a) => String(a.device_hash || '').trim())
      .filter(Boolean),
  )
  if (relFp) refereeDevices.add(relFp)

  for (const d of referrerDevices) {
    if (refereeDevices.has(d)) {
      rules.push('SHARED_DEVICE_HASH')
      break
    }
  }

  const referrerIps = new Set(
    (refAttributions || [])
      .map((a) => String(a.ip_hash || a.metadata?.ip_token || a.metadata?.ip_hash || '').trim())
      .filter(Boolean),
  )
  const refereeIps = new Set(
    (refereeAttributions || [])
      .map((a) => String(a.ip_hash || a.metadata?.ip_token || a.metadata?.ip_hash || '').trim())
      .filter(Boolean),
  )
  if (relIp) refereeIps.add(relIp)

  for (const ip of referrerIps) {
    if (refereeIps.has(ip)) {
      rules.push('SHARED_IP_HASH')
      break
    }
  }

  return { overlap: rules.length > 0, rules }
}

export class ReferralFraudGate {
  /**
   * Evaluate whether accrual should be fraud-held (no wallet credit).
   * @param {{ row: object, bookingId?: string, relation?: object }} params
   */
  static async evaluateAccrualForLedgerRow(params = {}) {
    const row = params.row || {}
    const referrerId = String(row.referrer_id || '').trim()
    const refereeId = String(row.referee_id || '').trim()
    const beneficiaryId = beneficiaryIdForLedgerRow(row)
    const ruleCodes = []

    if (await isReferralPayoutBlocked(beneficiaryId)) {
      ruleCodes.push('REFERRAL_PAYOUT_BLOCKED')
    }

    const queue = await hasOpenFraudQueueForUsers([beneficiaryId, referrerId, refereeId])
    if (queue.open) ruleCodes.push('FRAUD_QUEUE_OPEN')

    const graph = await detectReferralGraphOverlap(referrerId, refereeId)
    if (graph.overlap) ruleCodes.push(...graph.rules)

    const { data: profiles } = beneficiaryId
      ? await supabaseAdmin
          .from('partner_payout_profiles')
          .select('id,partner_id,payout_fingerprint,data')
          .eq('partner_id', beneficiaryId)
          .limit(5)
      : { data: [] }

    for (const p of profiles || []) {
      const fp =
        String(p.payout_fingerprint || '').trim() || computePayoutFingerprint(p.data) || ''
      if (!fp) continue
      const collision = await findPayoutFingerprintCollision(fp, beneficiaryId)
      if (collision) {
        ruleCodes.push('PAYOUT_FINGERPRINT_COLLISION')
        break
      }
    }

    const paymentCollision = await detectPaymentInstrumentCollision(
      referrerId,
      refereeId,
      params.bookingId || row.booking_id,
    )
    if (paymentCollision.collision) {
      ruleCodes.push('PAYMENT_INSTRUMENT_COLLISION')
      recordCriticalSignal('REFERRAL_SHADOW_PAYMENT_INSTRUMENT', {
        threshold: 1,
        windowMs: 300_000,
        tag: '[REFERRAL_SHADOW_FRAUD]',
        detailLines: [
          'rule: PAYMENT_INSTRUMENT_COLLISION',
          `referrer: ${referrerId}`,
          `referee: ${refereeId}`,
          `booking: ${String(params.bookingId || row.booking_id || '-')}`,
          `shared_tokens: ${(paymentCollision.sharedTokens || []).join(',') || '-'}`,
          'mode: shadow_soft_hold',
        ],
      })
    }

    const hold = ruleCodes.length > 0
    const fraudReason = ruleCodes.includes('PAYMENT_INSTRUMENT_COLLISION')
      ? 'PAYMENT_INSTRUMENT_COLLISION'
      : ruleCodes[0] || null

    return {
      hold,
      ruleCodes: [...new Set(ruleCodes)],
      severity: hold ? 'review' : 'allow',
      potentialFraud: hold,
      fraudReason,
      shadowAnalytics: paymentCollision.collision
        ? {
            payment_instrument_collision: true,
            shared_tokens: paymentCollision.sharedTokens || [],
          }
        : null,
      beneficiaryId,
      referrerId,
      refereeId,
    }
  }

  /**
   * Metadata patch for earned_held fraud gate rows (shadow-safe soft hold).
   * @param {object} prevMeta
   * @param {object} gate
   * @param {string} nowIso
   */
  static buildAccrualHoldMetadata(prevMeta, gate, nowIso) {
    const base = prevMeta && typeof prevMeta === 'object' ? { ...prevMeta } : {}
    const primaryReason =
      gate?.fraudReason ||
      (Array.isArray(gate?.ruleCodes) && gate.ruleCodes.includes('PAYMENT_INSTRUMENT_COLLISION')
        ? 'PAYMENT_INSTRUMENT_COLLISION'
        : gate?.ruleCodes?.[0]) ||
      null
    return {
      ...base,
      fraud_gate_hold: true,
      fraud_gate_rules: gate?.ruleCodes || [],
      fraud_gate_at: nowIso,
      fraud_gate_severity: gate?.severity || 'review',
      potential_fraud: true,
      ...(primaryReason ? { fraud_reason: primaryReason } : {}),
      ...(gate?.shadowAnalytics && typeof gate.shadowAnalytics === 'object'
        ? { shadow_analytics: gate.shadowAnalytics }
        : {}),
    }
  }

  /**
   * @param {{ partnerId: string, profileData: object, profileId?: string }} params
   */
  static async evaluatePayoutProfileSave(params = {}) {
    const partnerId = String(params.partnerId || '').trim()
    const profileData = params.profileData && typeof params.profileData === 'object' ? params.profileData : {}
    const fingerprint = computePayoutFingerprint(profileData)
    if (!fingerprint) {
      return { ok: true, fingerprint: null, autoBlock: false }
    }

    const collision = await findPayoutFingerprintCollision(fingerprint, partnerId)
    if (!collision) {
      return { ok: true, fingerprint, autoBlock: false }
    }

    await ReferralGuardService.enqueueFraudQueue({
      severity: 'block',
      source: 'payout_profile',
      ruleCodes: ['PAYOUT_FINGERPRINT_COLLISION'],
      reason: `Payout fingerprint reused by partner ${collision.partner_id}`,
      referrerId: partnerId,
      candidateUserId: String(collision.partner_id || ''),
      metadata: {
        payout_fingerprint: fingerprint,
        existing_profile_id: collision.id,
        existing_partner_id: collision.partner_id,
      },
    })

    await setReferralPayoutBlocked(partnerId, true, 'PAYOUT_FINGERPRINT_COLLISION')

    return {
      ok: false,
      error: 'PAYOUT_FINGERPRINT_COLLISION',
      fingerprint,
      autoBlock: true,
      collisionPartnerId: collision.partner_id,
    }
  }

  /**
   * @param {{ row: object, gate: object, bookingId?: string }} params
   */
  static async enqueueAccrualFraudHold(params = {}) {
    const row = params.row || {}
    const gate = params.gate || {}
    const beneficiaryId = gate.beneficiaryId || beneficiaryIdForLedgerRow(row)
    await ReferralGuardService.enqueueFraudQueue({
      severity: 'review',
      source: 'accrual',
      ruleCodes: gate.ruleCodes || [],
      reason: (gate.ruleCodes || []).join(',') || 'ACCRUAL_FRAUD_HOLD',
      referrerId: gate.referrerId || row.referrer_id,
      candidateUserId: beneficiaryId,
      metadata: {
        booking_id: params.bookingId || row.booking_id || null,
        ledger_id: row.id || null,
        amount_thb: round2(row.amount_thb),
      },
    })
  }

  /**
   * @param {string} userId
   */
  static async evaluateWithdrawal(userId) {
    const uid = String(userId || '').trim()
    if (!uid) return { ok: false, error: 'USER_ID_REQUIRED', blockers: ['USER_ID_REQUIRED'] }

    if (await isReferralPayoutBlocked(uid)) {
      return { ok: false, error: 'REFERRAL_PAYOUT_BLOCKED', blockers: ['REFERRAL_PAYOUT_BLOCKED'] }
    }

    const queue = await hasOpenFraudQueueForUsers([uid])
    if (queue.open) {
      return { ok: false, error: 'FRAUD_QUEUE_OPEN', blockers: ['FRAUD_QUEUE_OPEN'] }
    }

    const { data: profiles } = await supabaseAdmin
      .from('partner_payout_profiles')
      .select('payout_fingerprint,data')
      .eq('partner_id', uid)
      .limit(5)

    for (const p of profiles || []) {
      const fp = String(p.payout_fingerprint || '').trim() || computePayoutFingerprint(p.data) || ''
      if (!fp) continue
      const collision = await findPayoutFingerprintCollision(fp, uid)
      if (collision) {
        return {
          ok: false,
          error: 'PAYOUT_FINGERPRINT_COLLISION',
          blockers: ['PAYOUT_FINGERPRINT_COLLISION'],
        }
      }
    }

    return { ok: true }
  }

  /** @param {object} row referral_ledger row */
  static isFraudGateHeldRow(row) {
    const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}
    return meta.fraud_gate_hold === true
  }
}

export default ReferralFraudGate
