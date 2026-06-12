/**
 * Stage 131.7 — normalized payout fingerprint (RU bank: INN + account + BIK).
 */
import { createHash } from 'node:crypto'
import { validateRuInnChecksum } from '@/lib/referral/referral-ru-payout-profile.js'

function digitsOnly(value) {
  return String(value || '').replace(/\s/g, '')
}

/**
 * @param {Record<string, unknown> | null | undefined} data
 * @returns {string | null}
 */
export function computePayoutFingerprint(data) {
  const d = data && typeof data === 'object' ? data : {}
  const inn = digitsOnly(d.inn)
  const accountNumber = digitsOnly(d.accountNumber)
  const bik = digitsOnly(d.bik)
  if (!inn || !accountNumber || !bik) return null
  if (inn.length < 10 || accountNumber.length < 10 || bik.length < 9) return null
  if (!validateRuInnChecksum(inn)) return null
  const raw = `${inn}|${accountNumber}|${bik}`.toUpperCase()
  return createHash('sha256').update(raw).digest('hex').slice(0, 64)
}

export default { computePayoutFingerprint }
