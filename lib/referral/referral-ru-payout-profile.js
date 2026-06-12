/**
 * Stage 131.5 — SSOT: реквизиты RU-банка для вывода реферальных бонусов.
 * Переиспользует `partner_payout_profiles` + `pm-bank-ru` (TBANK_RU).
 */
import { PayoutRailsService } from '@/lib/services/payout-rails.service'
import { TBANK_REGISTRY_METHOD_ID } from '@/lib/services/tbank-payout-registry.service.js'

export const REFERRAL_RU_PAYOUT_METHOD_ID = TBANK_REGISTRY_METHOD_ID

function digitsOnly(value) {
  return String(value || '').replace(/\s/g, '')
}

/**
 * Russian INN checksum (10-digit legal entity or 12-digit individual).
 * @param {string | null | undefined} innRaw
 * @returns {boolean}
 */
export function validateRuInnChecksum(innRaw) {
  const inn = digitsOnly(innRaw)
  if (!/^\d{10}$/.test(inn) && !/^\d{12}$/.test(inn)) return false

  const modCheck = (coeffs) => {
    let sum = 0
    for (let i = 0; i < coeffs.length; i++) {
      sum += parseInt(inn[i], 10) * coeffs[i]
    }
    let check = sum % 11
    if (check === 10) check = 0
    return check
  }

  if (inn.length === 10) {
    const coeffs = [2, 4, 10, 3, 5, 9, 4, 6, 8]
    return modCheck(coeffs) === parseInt(inn[9], 10)
  }

  const coeffs11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8]
  if (modCheck(coeffs11) !== parseInt(inn[10], 10)) return false
  const coeffs12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]
  return modCheck(coeffs12) === parseInt(inn[11], 10)
}

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
