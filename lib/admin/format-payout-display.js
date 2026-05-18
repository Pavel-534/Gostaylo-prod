/**
 * Stage 100.8 — display payout amounts (same fields as partner preview / DB).
 */

export function fmtThbAdmin(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '—'
  return `฿${x.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * @param {{ finalAmount?: number, amount?: number, amountInPayoutCurrency?: number, payoutCurrency?: string, currency?: string }} p
 */
export function fmtAdminPayoutAmount(p) {
  const payoutCur = String(p?.payoutCurrency || p?.currency || 'THB').toUpperCase()
  const inPayout = p?.amountInPayoutCurrency
  if (payoutCur !== 'THB' && inPayout != null && Number.isFinite(Number(inPayout))) {
    const x = Number(inPayout)
    return `${x.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${payoutCur}`
  }
  const thb = Number(p?.finalAmount ?? p?.amount)
  return fmtThbAdmin(thb)
}
