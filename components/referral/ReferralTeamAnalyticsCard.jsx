'use client'

import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ReferralTeamMetricsStrip } from '@/components/referral/ReferralTeamMetricsStrip'
import { ReferralLedgerAmount } from '@/components/referral/ReferralLedgerAmount'
import { useReferralLedgerDisplay } from '@/lib/hooks/use-referral-ledger-display'
import { cn } from '@/lib/utils'
import { Info } from 'lucide-react'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
  MOBILE_FLAT_CARD_HEADER_CLASS,
  MOBILE_FLAT_INSET_CLASS,
} from '@/lib/ui/mobile-flat-canvas'

function currentMonthLabel(language) {
  const now = new Date()
  const locale = language === 'en' ? 'en-US' : language === 'zh' ? 'zh-CN' : language === 'th' ? 'th-TH' : 'ru-RU'
  const month = now.toLocaleString(locale, { month: 'long' })
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${now.getFullYear()}`
}

function LevelRow({ label, amount, pct, count, countLabel, tone, tooltipText, total, formatThbAsDisplay, t }) {
  const toneMap = {
    emerald: { bar: 'bg-emerald-500', text: 'text-emerald-700' },
    blue: { bar: 'bg-blue-500', text: 'text-blue-700' },
    violet: { bar: 'bg-violet-500', text: 'text-violet-700' },
  }
  const colors = toneMap[tone] || toneMap.emerald

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap justify-between gap-x-2 gap-y-1 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5 truncate">
          {label}
          {tooltipText ? (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-slate-400 shrink-0 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">{tooltipText}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </span>
        <span className="tabular-nums shrink-0 break-words text-right">
          {formatThbAsDisplay(amount)}
          {total > 0 ? ` (${pct}%)` : ''}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', colors.bar)} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      {count > 0 ? (
        <p className={cn('text-[10px]', colors.text)}>
          {count} {countLabel}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Stage 133 / 131.A6.2 — KPI grid, tier progress, L1/L2/L3 split for tab "Команда".
 */
export function ReferralTeamAnalyticsCard({
  teamAnalytics,
  ambassador,
  t,
  locale: _locale = 'ru-RU',
  language = 'ru',
}) {
  const { formatThbAsDisplay } = useReferralLedgerDisplay()
  const ta = teamAnalytics
  if (!ta?.earnings) return null

  const l1 = Number(ta.earnings.breakdown?.l1DirectThb || 0)
  const l2Full = Number(ta.earnings.breakdown?.l2NetworkThb || 0)
  const l3 = Number(ta.earnings.breakdown?.l3NetworkThb || 0)
  const l2 = Math.max(0, l2Full - l3)
  const total = Number(ta.earnings.totalTeamEarningsThb || 0)
  const lifetime = Number(ta.earnings.lifetimeTeamEarningsThb || 0)
  const retention = ta.network?.retention
  const progress = ta.progress || {}
  const nextTier = ambassador?.nextTier
  const remaining = Number(progress.remainingToNextTier ?? ambassador?.remainingToNextTier ?? 0)
  const tierPct = Number(progress.tierProgressPercent ?? ambassador?.tierProgressPercent ?? 0)
  const shadow = ta.shadowL2Notice

  const l1Pct = total > 0 ? Math.round((l1 / total) * 100) : 0
  const l2Pct = total > 0 ? Math.round((l2 / total) * 100) : 0
  const l3Pct = total > 0 ? Math.round((l3 / total) * 100) : 0

  const l1Count = Number(ta.earnings.breakdown?.l1DistinctCount || 0)
  const l2Count = Number(ta.earnings.breakdown?.l2DistinctCount || 0)
  const l3Count = Number(ta.earnings.breakdown?.l3DistinctCount || 0)

  const monthLabel = currentMonthLabel(language)
  const isEmpty = total <= 0 && lifetime <= 0

  return (
    <div className="space-y-4">
      <ReferralTeamMetricsStrip
        friendsInvited={ta.network?.directInvitesTotal}
        directPartnersInvited={ta.network?.directPartnersTotal}
        teamEarningsThb={total}
        retentionRatePercent={retention?.ratePercent}
        t={t}
      />

      <Card className={MOBILE_FLAT_CARD_CLASS}>
        <CardHeader className={cn(MOBILE_FLAT_CARD_HEADER_CLASS, 'sm:pb-2')}>
          <CardTitle className="text-base">{t('stage133_analyticsTitle')}</CardTitle>
          <CardDescription>{t('stage133_analyticsSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'space-y-4')}>
          {isEmpty ? (
            <p className="text-sm text-slate-500 py-4 text-center" data-testid="team-analytics-empty">
              {t('stage133_emptyState')}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 min-w-0">
                <div className={cn(MOBILE_FLAT_INSET_CLASS, 'min-w-0 sm:border-slate-100 sm:bg-slate-50/80 sm:px-3 sm:py-2.5 sm:space-y-0')}>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500 truncate">
                    {t('stage133_periodMonthYear', { month: monthLabel.split(' ')[0], year: monthLabel.split(' ').slice(1).join(' ') })}
                  </p>
                  <p className="text-base sm:text-xl font-bold text-brand break-words">
                    <ReferralLedgerAmount thb={total} className="font-bold" />
                  </p>
                </div>
                <div className={cn(MOBILE_FLAT_INSET_CLASS, 'min-w-0 sm:border-slate-100 sm:bg-slate-50/80 sm:px-3 sm:py-2.5 sm:space-y-0')}>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500 truncate">
                    {t('stage133_lifetimeEarnings')}
                  </p>
                  <p className="text-base sm:text-xl font-bold text-slate-900 break-words">
                    <ReferralLedgerAmount thb={lifetime} className="font-bold" />
                  </p>
                </div>
              </div>

              <div className="space-y-3" data-testid="team-analytics-levels">
                <LevelRow
                  label={t('stage133_l1Direct')}
                  amount={l1} pct={l1Pct} count={l1Count}
                  countLabel={t('stage133_partnersDirect')}
                  tone="emerald"
                  tooltipText={t('stage133_l1Tooltip')}
                  total={total}
                  formatThbAsDisplay={formatThbAsDisplay}
                  t={t}
                />
                <LevelRow
                  label={t('stage133_l2Network')}
                  amount={l2} pct={l2Pct} count={l2Count}
                  countLabel={t('stage133_partnersInNetwork')}
                  tone="blue"
                  tooltipText={t('stage133_l2Tooltip')}
                  total={total}
                  formatThbAsDisplay={formatThbAsDisplay}
                  t={t}
                />
                {(l3 > 0 || total > 0) ? (
                  <LevelRow
                    label={t('stage133_l3Network')}
                    amount={l3} pct={l3Pct} count={l3Count}
                    countLabel={t('stage133_partnersInDeep')}
                    tone="violet"
                    tooltipText={t('stage133_l3Tooltip')}
                    total={total}
                    formatThbAsDisplay={formatThbAsDisplay}
                    t={t}
                  />
                ) : null}
              </div>
            </>
          )}

          {retention != null ? (
            <div className={cn(MOBILE_FLAT_INSET_CLASS, 'min-w-0 sm:border-emerald-100 sm:bg-emerald-50/60 sm:px-3 sm:py-2.5 sm:space-y-0')}>
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
            <div className={cn(MOBILE_FLAT_INSET_CLASS, 'sm:border-brand/20 sm:bg-brand/5 sm:px-3 sm:py-3')}>
              <p className="text-sm font-medium text-slate-900">
                {t('stage133_tierProgressTitle', { tier: String(nextTier.name || '') })}
              </p>
              <Progress value={tierPct} className="h-2" />
              <p className="text-xs text-slate-600">
                {t('stage133_tierRemaining', { count: String(remaining) })}
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
