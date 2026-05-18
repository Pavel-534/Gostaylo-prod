const RUB_PAYOUT_METHOD_IDS_INNER = new Set(['pm-bank-ru', 'pm-card-ru'])
const USDT_PAYOUT_METHOD_ID_INNER = 'pm-usdt-trc20'

function normalizeCurrency(code) {
  return String(code || 'THB').toUpperCase().trim()
}

/**
 * Client/server-safe payout rail currency resolver (no Node-only imports).
 * @param {string | null | undefined} payoutMethodId
 * @param {{ id?: string, channel?: string, currency?: string } | null} [method]
 */
export function resolvePayoutCurrency(payoutMethodId, method = null) {
  const id = String(payoutMethodId || method?.id || '').trim()
  const channel = String(method?.channel || '').toUpperCase()
  const methodCurrency = normalizeCurrency(method?.currency)

  if (id === USDT_PAYOUT_METHOD_ID_INNER || channel === 'CRYPTO' || methodCurrency === 'USDT') {
    return 'USDT'
  }
  if (
    RUB_PAYOUT_METHOD_IDS_INNER.has(id) ||
    (channel === 'BANK' && methodCurrency === 'RUB') ||
    (channel === 'CARD' && methodCurrency === 'RUB')
  ) {
    return 'RUB'
  }
  if (methodCurrency && methodCurrency !== 'THB') return methodCurrency
  return 'THB'
}

export const RUB_PAYOUT_METHOD_IDS = RUB_PAYOUT_METHOD_IDS_INNER
export const USDT_PAYOUT_METHOD_ID = USDT_PAYOUT_METHOD_ID_INNER
