'use client'

import { Progress } from '@/components/ui/progress'
import { fmtThb } from '@/lib/admin/fintech-console-shared'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { useMemo } from 'react'

/**
 * Stage 114.7 / 131.A1.3 — месячный spend + независимые алерты 150k / 80% program cap.
 * @param {{ accounting?: object }} props
 */
export function ReferralMonthlySpendBar({ accounting: acc }) {
  const { language } = useI18n()
  const t = useMemo(() => (key) => getUIText(key, language), [language])

  if (!acc?.monthlySpendAlertThb) return null

  const earned = Number(acc.monthlyEarnedThb || 0)
  const limit = Number(acc.monthlySpendAlertThb)
  const pct = Number(acc.monthlySpendPercent ?? 0)
  const early = Boolean(acc.monthlySpendAlertTriggered)
  const approachingCap = Boolean(acc.approachingCapTriggered ?? acc.monthlySpendApproaching)
  const warnPct = Number(acc.programCapWarnPercent ?? acc.monthlySpendWarnPercent ?? 80)
  const showAlerts = early || approachingCap

  const tone = approachingCap ? 'warn' : early ? 'info' : 'ok'
  const barClass =
    tone === 'warn' ? '[&>div]:bg-amber-500' : tone === 'info' ? '[&>div]:bg-slate-500' : '[&>div]:bg-brand'

  const boxClass =
    tone === 'warn'
      ? 'border-amber-200 bg-amber-50/90 text-amber-950'
      : tone === 'info'
        ? 'border-slate-200 bg-slate-50/90 text-slate-800'
        : 'border-slate-200 bg-slate-50/80 text-slate-800'

  return (
    <div className="space-y-3">
      {showAlerts ? (
        <div className="space-y-2" data-testid="referral-finance-alerts">
          {early ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800">
              <p className="font-semibold">{t('admin_finance_alert_early')}</p>
              <p className="mt-1 text-xs opacity-80">
                {fmtThb(earned)} / {fmtThb(limit)} THB
              </p>
            </div>
          ) : null}
          {approachingCap ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950">
              <p className="font-semibold">{t('admin_finance_alert_approaching_cap')}</p>
              <p className="mt-1 text-xs opacity-90">
                {fmtThb(earned)} ≥ {warnPct}% × {fmtThb(acc.programCapThb)} ({fmtThb(acc.programCapWarnThb)})
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={`rounded-lg border px-3 py-3 space-y-2 text-sm ${boxClass}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-semibold">Месячный referral spend (earned, UTC)</p>
          <p className="tabular-nums text-xs sm:text-sm">
            <span className="font-bold">{fmtThb(earned)}</span>
            <span className="opacity-70"> / {fmtThb(limit)} THB</span>
            <span className="ml-1 opacity-70">({pct}%)</span>
          </p>
        </div>
        <Progress value={Math.min(100, pct)} className={`h-2.5 ${barClass}`} />
      </div>
    </div>
  )
}
