'use client'

import { useMemo } from 'react'
import { useStorefrontDisplayFx } from '@/lib/hooks/use-storefront-display-fx'
import { cn } from '@/lib/utils'

/**
 * ADR-181 Wave 3 — Airbnb-style three-line partner earnings preview.
 * No ledger / FX jargon — only what the host earns per unit.
 */
export function WizardPartnerEarningsCalculator({
  t,
  tr,
  baseAmount,
  baseCurrency = 'THB',
  hostCommissionPercent = 0,
  periodLabel,
  className,
}) {
  const { formatInListingBase } = useStorefrontDisplayFx()

  const { base, pct, hostFeeAmount, payout } = useMemo(() => {
    const b = parseFloat(String(baseAmount)) || 0
    const p = Number(hostCommissionPercent)
    const safePct = Number.isFinite(p) && p >= 0 ? p : 0
    const fee = Math.round(b * (safePct / 100))
    return {
      base: b,
      pct: safePct,
      hostFeeAmount: fee,
      payout: Math.max(0, Math.round(b - fee)),
    }
  }, [baseAmount, hostCommissionPercent])

  if (!(base > 0)) return null

  const formattedBase = formatInListingBase(base, baseCurrency)
  const formattedFee =
    hostFeeAmount > 0 ? `−${formatInListingBase(hostFeeAmount, baseCurrency)}` : formatInListingBase(0, baseCurrency)
  const formattedPayout = formatInListingBase(payout, baseCurrency)

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm',
        className,
      )}
      data-testid="wizard-partner-earnings-calculator"
    >
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3.5 sm:px-5">
        <span className="text-sm text-slate-600">
          {tr('wizardPriceCalcLinePrice', { period: periodLabel })}
        </span>
        <span className="text-sm font-medium text-slate-900 tabular-nums">{formattedBase}</span>
      </div>
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3.5 sm:px-5">
        <span className="text-sm text-slate-600">
          {tr('wizardPriceCalcLineHostFee', { pct: String(pct) })}
        </span>
        <span className="text-sm text-slate-500 tabular-nums">{formattedFee}</span>
      </div>
      <div className="flex items-center justify-between gap-4 bg-slate-50/90 px-4 py-4 sm:px-5">
        <span className="text-sm font-semibold text-slate-900">{t('wizardPriceCalcLinePayout')}</span>
        <span className="text-lg font-bold text-slate-900 tabular-nums">{formattedPayout}</span>
      </div>
    </div>
  )
}
