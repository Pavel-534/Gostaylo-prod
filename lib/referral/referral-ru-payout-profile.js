/**
 * Stage 131.5 — SSOT: реквизиты RU-банка для вывода реферальных бонусов.
 * Переиспользует `partner_payout_profiles` + `pm-bank-ru` (TBANK_RU).
 */
import { PayoutRailsService } from '@/lib/services/payout-rails.service'
import { TBANK_REGISTRY_METHOD_ID } from '@/lib/services/tbank-payout-registry.service.js'
import {
  digitsOnly,
  validateRuInnChecksum,
} from '@/lib/referral/validate-ru-inn.js'

export const REFERRAL_RU_PAYOUT_METHOD_ID = TBANK_REGISTRY_METHOD_ID

export { validateRuInnChecksum, digitsOnly }

/**
 * @param {Record<string, unknown> | null | undefined} data
 */
export function isRuBankProfileDataComplete(data) {
  const d = data && typeof data === 'object' ? data : {}
  const recipient = String(d.recipientName || d.fullName || '').trim()
  const accountNumber = String(d.accountNumber || '').replace(/\s/g, '')
  const bik = String(d.bik || '').replace(/\s/g, '')
  const inn = digitsOnly(d.inn)
  if (!(recipient && accountNumber && bik && inn)) return false
  return validateRuInnChecksum(inn)
}

/**
 * @param {{ method_id?: string, method?: { id?: string }, data?: object, is_verified?: boolean, is_default?: boolean }} profile
 */
export function isReferralRuPayoutProfile(profile) {
  if (!profile?.method_id && !profile?.method?.id) return false
  const methodId = String(profile.method_id || profile.method?.id || '')
  return methodId === REFERRAL_RU_PAYOUT_METHOD_ID
}

/**
 * @param {string} userId
 */
export async function getReferralRuPayoutProfile(userId) {
  const uid = String(userId || '').trim()
  if (!uid) return null
  const profiles = await PayoutRailsService.listPartnerPayoutProfiles(uid)
  const ruProfiles = (profiles || []).filter(isReferralRuPayoutProfile)
  if (!ruProfiles.length) return null
  return ruProfiles.find((p) => p.is_default === true) || ruProfiles[0]
}

/**
 * @param {string} userId
 * @returns {Promise<{ ok: boolean, profile?: object | null, error?: string, blockers?: string[] }>}
 */
export async function assertReferralRuPayoutProfileReady(userId) {
  const profile = await getReferralRuPayoutProfile(userId)
  if (!profile?.id) {
    return {
      ok: false,
      error: 'REFERRAL_RU_PAYOUT_PROFILE_REQUIRED',
      blockers: ['REFERRAL_RU_PAYOUT_PROFILE_REQUIRED'],
    }
  }
  if (!isRuBankProfileDataComplete(profile.data)) {
    const inn = String(profile.data?.inn || '').replace(/\s/g, '')
    const blockers = ['REFERRAL_RU_PAYOUT_PROFILE_INCOMPLETE']
    if (inn && !validateRuInnChecksum(inn)) blockers.push('REFERRAL_RU_INN_CHECKSUM_INVALID')
    return {
      ok: false,
      error: blockers.includes('REFERRAL_RU_INN_CHECKSUM_INVALID')
        ? 'REFERRAL_RU_INN_CHECKSUM_INVALID'
        : 'REFERRAL_RU_PAYOUT_PROFILE_INCOMPLETE',
      blockers,
      profile,
    }
  }
  return { ok: true, profile }
}

export default {
  REFERRAL_RU_PAYOUT_METHOD_ID,
  validateRuInnChecksum,
  isRuBankProfileDataComplete,
  isReferralRuPayoutProfile,
  getReferralRuPayoutProfile,
  assertReferralRuPayoutProfileReady,
}
