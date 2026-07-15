'use client'

import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ReferralTeamMetricsStrip } from '@/components/referral/ReferralTeamMetricsStrip'
import { ReferralLedgerAmount } from '@/components/referral/ReferralLedgerAmount'
import { useReferralLedgerDisplay } from '@/lib/hooks/use-referral-ledger-display'

/**
 * Stage 133 — KPI grid, tier progress, L1/L2 split for tab «Команда».
 */
export function ReferralTeamAnalyticsCard({
  teamAnalytics,
  ambassador,
  t,
  locale: _locale = 'ru-RU',
}) {
  const { formatThbAsDisplay } = useReferralLedgerDisplay()
  const ta = teamAnalytics
  if (!ta?.earnings) return null

  const l1 = Number(ta.earnings.breakdown?.l1DirectThb || 0)
  const l2 = Number(ta.earnings.breakdown?.l2NetworkThb || 0)
  const total = Number(ta.earnings.totalTeamEarningsThb || 0)
  const lifetime = Number(ta.earnings.lifetimeTeamEarningsThb || 0)
  const retention = ta.network?.retention
  const progress = ta.progress || {}
  const nextTier = ambassador?.nextTier
  const remaining = Number(progress.remainingToNextTier ?? ambassador?.remainingToNextTier ?? 0)
  const tierPct = Number(progress.tierProgressPercent ?? ambassador?.tierProgressPercent ?? 0)
  const shadow = ta.shadowL2Notice

  const l1Pct = total > 0 ? Math.round((l1 / total) * 100) : 0
  const l2Pct = total > 0 ? Math.round((l2 / total) * 100) : 100 - l1Pct

  return (
    <div className="space-y-4">
      <ReferralTeamMetricsStrip
        friendsInvited={ta.network?.directInvitesTotal}
        directPartnersInvited={ta.network?.directPartnersTotal}
        teamEarningsThb={total}
        retentionRatePercent={retention?.ratePercent}
        t={t}
      />

      <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('stage133_analyticsTitle')}</CardTitle>
          <CardDescription>{t('stage133_analyticsSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 min-w-0">
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-slate-500 truncate">
                {t('stage133_periodEarnings')}
              </p>
              <p className="text-base sm:text-xl font-bold text-brand break-words">
                <ReferralLedgerAmount thb={total} className="font-bold" />
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-slate-500 truncate">
                {t('stage133_lifetimeEarnings')}
              </p>
              <p className="text-base sm:text-xl font-bold text-slate-900 break-words">
                <ReferralLedgerAmount thb={lifetime} className="font-bold" />
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap justify-between gap-x-2 gap-y-1 text-xs text-slate-600">
              <span className="truncate">{t('stage133_l1Direct')}</span>
              <span className="tabular-nums shrink-0 break-words text-right">
                {formatThbAsDisplay(l1)} ({l1Pct}%)
              </span>
            </div>
            <Progress value={l1Pct} className="h-2" />
            <div className="flex flex-wrap justify-between gap-x-2 gap-y-1 text-xs text-slate-600">
              <span className="truncate">{t('stage133_l2Network')}</span>
              <span className="tabular-nums shrink-0 break-words text-right">
                {formatThbAsDisplay(l2)} ({l2Pct}%)
              </span>
            </div>
            <Progress value={l2Pct} className="h-2 bg-slate-100" />
          </div>

          {retention != null ? (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2.5 min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-emerald-800/80 truncate">
                {t('stage133_retentionLabel')}
              </p>
              <p className="text-xl font-bold tabular-nums text-emerald-950 truncate">
                {Number(retention.ratePercent ?? 0).toFixed(1)}%
              </p>
              {Number(retention.denominator) > 0 ? (
                <p className="text-xs text-emerald-900/70 truncate">
                  {t('stage133_retentionDetail', {
                    active: String(retention.numerator ?? 0),
                    total: String(retention.denominator ?? 0),
                  })}
                </p>
              ) : null}
            </div>
          ) : null}

          {nextTier ? (
            <div className="rounded-xl border border-brand/20 bg-brand/5 px-3 py-3 space-y-2">
              <p className="text-sm font-medium text-slate-900">
                {t('stage133_tierProgressTitle').replace('{tier}', String(nextTier.name || ''))}
              </p>
              <Progress value={tierPct} className="h-2" />
              <p className="text-xs text-slate-600">
                {t('stage133_tierRemaining').replace('{count}', String(remaining))}
              </p>
            </div>
          ) : (
            <p className="text-xs text-emerald-700">{t('stage133_tierMax')}</p>
          )}

          {shadow?.applicable && shadow?.messageKey ? (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed break-words">
              {t(shadow.messageKey, {
                amount: shadow.shadowMonthlyThb ? formatThbAsDisplay(shadow.shadowMonthlyThb) : '—',
              })}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

export default ReferralTeamAnalyticsCard
