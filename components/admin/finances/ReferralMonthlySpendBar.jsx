'use client'

import { Progress } from '@/components/ui/progress'
import { fmtThb } from '@/lib/admin/fintech-console-shared'

/**
 * Stage 114.7 — месячный spend vs лимит (FinTech).
 * @param {{ accounting?: object }} props
 */
export function ReferralMonthlySpendBar({ accounting: acc }) {
  if (!acc?.monthlySpendAlertThb) return null

  const earned = Number(acc.monthlyEarnedThb || 0)
  const limit = Number(acc.monthlySpendAlertThb)
  const pct = Number(acc.monthlySpendPercent ?? 0)
  const triggered = Boolean(acc.monthlySpendAlertTriggered)
  const approaching = Boolean(acc.monthlySpendApproaching)
  const warnPct = Number(acc.monthlySpendWarnPercent ?? 80)

  const tone = triggered ? 'exceeded' : approaching ? 'warn' : 'ok'
  const barClass =
    tone === 'exceeded'
      ? '[&>div]:bg-rose-600'
      : tone === 'warn'
        ? '[&>div]:bg-amber-500'
        : '[&>div]:bg-brand'

  const boxClass =
    tone === 'exceeded'
      ? 'border-rose-200 bg-rose-50/90 text-rose-950'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50/90 text-amber-950'
        : 'border-slate-200 bg-slate-50/80 text-slate-800'

  return (
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
      {triggered ? (
        <p className="text-xs font-medium">
          Порог превышен — ревью топ-амбассадоров, hold подозрительных pending, TG FINANCE.
        </p>
      ) : approaching ? (
        <p className="text-xs font-medium">
          Приближение к лимиту (≥ {warnPct}% = {fmtThb(acc.monthlySpendWarnThb)} THB). Осталось{' '}
          {fmtThb(acc.monthlySpendRemainingThb)} THB до hard alert.
        </p>
      ) : (
        <p className="text-xs opacity-80">
          Предупреждение FinTech с {warnPct}% лимита ({fmtThb(acc.monthlySpendWarnThb)} THB). Hard alert при{' '}
          {fmtThb(limit)} THB.
        </p>
      )}
    </div>
  )
}
