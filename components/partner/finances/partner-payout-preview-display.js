/**
 * Stage 100.7 — display-only helpers for server payout preview (no client FX).
 */

import { formatPrice } from '@/lib/currency'

export function interpolateTemplate(template, vars = {}) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''))
}

/** Format amount in payout currency from server (no rateMap conversion). */
export function formatServerPayoutAmount(amount, currencyCode, language = 'ru') {
  const n = Number(amount)
  const cur = String(currencyCode || 'THB').toUpperCase()
  if (!Number.isFinite(n)) return '—'
  if (cur === 'THB') return formatPrice(n, 'THB', { THB: 1 }, language)
  const loc = language === 'ru' ? 'ru-RU' : 'en-US'
  const suffix = { RUB: '₽', USDT: '₮', USD: '$', EUR: '€' }[cur] || cur
  return `${n.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${suffix}`
}

export function buildPayoutReceiveRateLine(t, preview, language) {
  if (!preview?.fx?.effectiveRateToThb) return null
  const payoutCurrency = preview.payoutCurrency || 'THB'
  const receiveApprox = formatServerPayoutAmount(
    preview.amountInPayoutCurrency,
    payoutCurrency,
    language,
  )
  return interpolateTemplate(t('partnerFinances_withdrawReceiveApprox'), {
    amount: receiveApprox,
    currency: payoutCurrency,
    rate: Number(preview.fx.effectiveRateToThb).toFixed(4),
    spread: String(preview.fx.spreadPct ?? 0),
  })
}
