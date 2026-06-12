/**
 * Stage 131.7 — fuzzy match RU payout recipient name vs KYC profile name.
 */

function normalizeNameToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]/gi, '')
}

/**
 * @param {string | null | undefined} recipientName — from payout profile
 * @param {string | null | undefined} firstName
 * @param {string | null | undefined} lastName
 * @returns {boolean}
 */
export function referralPayoutNameMatchesKyc(recipientName, firstName, lastName) {
  const recipient = normalizeNameToken(recipientName)
  const first = normalizeNameToken(firstName)
  const last = normalizeNameToken(lastName)
  if (!recipient || (!first && !last)) return false

  const kycFull = `${first}${last}`.trim()
  const kycReversed = `${last}${first}`.trim()
  if (!kycFull) return false

  if (recipient === kycFull || recipient === kycReversed) return true
  if (kycFull.length >= 4 && recipient.includes(kycFull)) return true
  if (kycReversed.length >= 4 && recipient.includes(kycReversed)) return true
  if (first && last && recipient.includes(first) && recipient.includes(last)) return true

  return false
}

export default { referralPayoutNameMatchesKyc }
