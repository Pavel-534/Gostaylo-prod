/**
 * Map server withdrawal validation errors to localized display-currency copy (Stage 188.3).
 * Prevents leaking raw "1000 THB" strings to RUB/USD users.
 */

const THB_MIN_PATTERNS = [
  /at least\s+\d[\d\s,.]*\s*THB/i,
  /minimum.*\d[\d\s,.]*\s*THB/i,
  /1000\s*THB/i,
  /минимум.*THB/i,
  /не менее.*THB/i,
  /BELOW_MIN/i,
]

export function isWithdrawMinThbServerError(message) {
  const s = String(message || '').trim()
  if (!s) return false
  return THB_MIN_PATTERNS.some((re) => re.test(s))
}

export function localizeWithdrawValidationError(message, t, formatMinPayoutThreshold, minPayoutThb) {
  const s = String(message || '').trim()
  if (!s) return s
  if (isWithdrawMinThbServerError(s)) {
    return t('stage188_withdrawMinRequired', {
      minAmount: formatMinPayoutThreshold(minPayoutThb),
    })
  }
  return s
}
