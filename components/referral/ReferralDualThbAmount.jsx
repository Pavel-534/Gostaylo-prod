'use client'

/**
 * Stage 133 — THB ledger amount with optional RUB display (mid rate from referral/me.sharePitchFx).
 */
export function ReferralDualThbAmount({
  thb,
  displayCurrency = 'THB',
  midRateRubToThb = null,
  locale = 'ru-RU',
  className = '',
  primaryClassName = '',
  secondaryClassName = 'text-slate-500 font-normal text-[0.85em]',
  emptyLabel = '—',
}) {
  const n = Number(thb)
  if (!Number.isFinite(n) || n <= 0) {
    return <span className={className}>{emptyLabel}</span>
  }

  const currency = String(displayCurrency || 'THB').toUpperCase()
  const rate = Number(midRateRubToThb)
  const showRub = currency === 'RUB' && Number.isFinite(rate) && rate > 0

  if (showRub) {
    const rub = Math.round(n / rate)
    return (
      <span className={`tabular-nums ${className}`}>
        <span className={primaryClassName}>
          {rub.toLocaleString(locale, { maximumFractionDigits: 0 })} ₽
        </span>
        <span className={secondaryClassName}>
          {' '}
          · {n.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} THB
        </span>
      </span>
    )
  }

  return (
    <span className={`tabular-nums ${className}`}>
      {n.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} THB
    </span>
  )
}

export default ReferralDualThbAmount
