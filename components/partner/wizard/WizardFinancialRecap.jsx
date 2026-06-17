'use client'

import { Banknote, Shield } from 'lucide-react'
import { getHostMoneyPolicyForListing } from '@/lib/booking/host-money-stage'

/**
 * Stage 156.3 — financial trust seal on wizard preview step.
 */
export function WizardFinancialRecap({
  language = 'ru',
  tr,
  basePriceThb,
  hostNetThb,
  hostCommissionPercent,
  categorySlug,
  wizardProfile,
  numberLocale = 'ru-RU',
}) {
  const base = Number(basePriceThb) || 0
  const net = Number(hostNetThb) || 0
  const pct = Number(hostCommissionPercent)
  if (!(base > 0) || !(net > 0)) return null

  const num = (n) => (typeof n === 'number' ? n.toLocaleString(numberLocale) : n)
  const payoutPolicy = getHostMoneyPolicyForListing({ categorySlug, wizardProfile }, language)
  const commissionLabel =
    Number.isFinite(pct) && pct === 0
      ? tr('wizardFinancialRecap_zeroCommission', {})
      : tr('wizardFinancialRecap_commissionLine', { pct: String(pct) })

  return (
    <div className="rounded-2xl border border-brand/25 bg-gradient-to-br from-brand/10 via-white to-white p-4 sm:p-5 space-y-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand">
          <Banknote className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-slate-900">{tr('wizardFinancialRecap_title', {})}</p>
          <p className="text-sm leading-relaxed text-slate-700">
            {tr('wizardFinancialRecap_summary', {
              base: num(base),
              net: num(net),
            })}
          </p>
          <p className="text-sm font-medium text-brand">{commissionLabel}</p>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200/80 bg-white/80 px-3 py-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 shrink-0 text-brand" aria-hidden />
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            {tr('wizardFinancialRecap_escrowTitle', {})}
          </p>
        </div>
        <p className="text-xs leading-relaxed text-slate-600">{payoutPolicy.wizardBlurb}</p>
        {payoutPolicy.protected ? (
          <p className="text-xs leading-relaxed text-slate-500">{payoutPolicy.protected}</p>
        ) : null}
      </div>
    </div>
  )
}
