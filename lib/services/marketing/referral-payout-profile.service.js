/**
 * Stage 131.7 — shared save path for RU referral payout profiles (fingerprint + auto-verify).
 */
import { supabaseAdmin } from '@/lib/supabase'
import { computePayoutFingerprint } from '@/lib/referral/payout-profile-fingerprint.js'
import { referralPayoutNameMatchesKyc } from '@/lib/referral/referral-name-match.js'
import { isRuBankProfileDataComplete } from '@/lib/referral/referral-ru-payout-profile.js'
import {
  ReferralFraudGate,
  hasOpenFraudQueueForUsers,
  findPayoutFingerprintCollision,
} from '@/lib/services/marketing/referral-fraud-gate.service.js'

/**
 * @param {string} userId
 */
export async function tryAutoVerifyReferralPayoutProfile(userId, profileData) {
  const uid = String(userId || '').trim()
  if (!uid || !isRuBankProfileDataComplete(profileData)) return false

  const { data: prof } = await supabaseAdmin
    .from('profiles')
    .select('is_verified,first_name,last_name')
    .eq('id', uid)
    .maybeSingle()
  if (prof?.is_verified !== true) return false

  const queue = await hasOpenFraudQueueForUsers([uid])
  if (queue.open) return false

  const fingerprint = computePayoutFingerprint(profileData)
  if (!fingerprint) return false

  const collision = await findPayoutFingerprintCollision(fingerprint, uid)
  if (collision) return false

  const recipient = String(profileData.recipientName || profileData.fullName || '')
  if (!referralPayoutNameMatchesKyc(recipient, prof.first_name, prof.last_name)) return false

  return true
}

/**
 * @param {{
 *   userId: string,
 *   methodId: string,
 *   formData: object,
 *   existingProfile?: object | null,
 *   profileId?: string,
 * }} params
 */
export async function saveReferralRuPayoutProfile(params) {
  const userId = String(params.userId || '').trim()
  const methodId = String(params.methodId || '').trim()
  const formData = params.formData && typeof params.formData === 'object' ? params.formData : {}
  const nowIso = new Date().toISOString()

  if (!userId || !methodId) {
    return { success: false, error: 'INVALID_PARAMS', status: 400 }
  }
  if (!isRuBankProfileDataComplete(formData)) {
    return { success: false, error: 'REFERRAL_RU_PAYOUT_PROFILE_INCOMPLETE', status: 400 }
  }

  const payload = {
    recipientName: String(formData.recipientName || formData.fullName || '').trim(),
    inn: String(formData.inn || '').replace(/\s/g, ''),
    bik: String(formData.bik || '').replace(/\s/g, ''),
    accountNumber: String(formData.accountNumber || '').replace(/\s/g, ''),
  }

  const fingerprintGate = await ReferralFraudGate.evaluatePayoutProfileSave({
    partnerId: userId,
    profileData: payload,
  })
  if (!fingerprintGate.ok) {
    return {
      success: false,
      error: fingerprintGate.error || 'PAYOUT_FINGERPRINT_COLLISION',
      status: 403,
    }
  }

  const autoVerified = await tryAutoVerifyReferralPayoutProfile(userId, payload)
  const profileMeta = autoVerified
    ? { source: 'kyc_trusted', auto_verified_at: nowIso }
    : { source: 'manual_pending' }

  const existing = params.existingProfile
  if (existing?.id) {
    if (existing.is_verified === true) {
      return {
        success: false,
        error:
          'Подтверждённый профиль нельзя изменить. Обратитесь в поддержку для смены реквизитов.',
        status: 403,
      }
    }
    const { data, error } = await supabaseAdmin
      .from('partner_payout_profiles')
      .update({
        data: payload,
        payout_fingerprint: fingerprintGate.fingerprint,
        is_verified: autoVerified,
        is_default: true,
        metadata: profileMeta,
        updated_at: nowIso,
      })
      .eq('id', existing.id)
      .eq('partner_id', userId)
      .select('*, method:payout_methods(*)')
      .single()
    if (error) return { success: false, error: error.message, status: 400 }
    return { success: true, data: { profile: data, updated: true, autoVerified } }
  }

  await supabaseAdmin
    .from('partner_payout_profiles')
    .update({ is_default: false, updated_at: nowIso })
    .eq('partner_id', userId)
    .eq('is_default', true)

  const profileId = params.profileId || `ppp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const { data, error } = await supabaseAdmin
    .from('partner_payout_profiles')
    .insert({
      id: profileId,
      partner_id: userId,
      method_id: methodId,
      data: payload,
      payout_fingerprint: fingerprintGate.fingerprint,
      is_verified: autoVerified,
      is_default: true,
      metadata: profileMeta,
    })
    .select('*, method:payout_methods(*)')
    .single()
  if (error) return { success: false, error: error.message, status: 400 }
  return { success: true, data: { profile: data, created: true, autoVerified } }
}

export default { saveReferralRuPayoutProfile, tryAutoVerifyReferralPayoutProfile }
