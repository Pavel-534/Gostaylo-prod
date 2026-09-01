'use client'

import { Users, UserCheck } from 'lucide-react'
import { ReferralLedgerAmount } from '@/components/referral/ReferralLedgerAmount'
import { PartnerMetricsTooltip } from '@/components/referral/PartnerMetricsTooltip'
import { PARTNER_METRICS_AXES } from '@/lib/referral/partner-metrics-glossary.js'

/**
 * Stage 131.5 — честное разделение метрик команды (SSOT).
 * Stage 202.26 — glossary tooltips per metric axis.
 */
export function ReferralTeamMetricsStrip({
  friendsInvited = 0,
  directPartnersInvited = 0,
  teamEarningsThb = null,
  retentionRatePercent = null,
  variant = 'light',
  t,
  className = '',
}) {
  const friends = Math.max(0, Number(friendsInvited) || 0)
  const partners = Math.max(0, Number(directPartnersInvited) || 0)
  const isDark = variant === 'dark'

  const cardCn = isDark
    ? 'rounded-xl bg-white/10 backdrop-blur px-3 py-2.5 border border-white/15'
    : 'rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3'
  const labelCn = isDark
    ? 'text-[10px] uppercase tracking-wide text-white/75'
    : 'text-[10px] uppercase tracking-wide text-slate-500'
  const valueCn = isDark ? 'text-xl font-bold tabular-nums text-white' : 'text-2xl font-bold tabular-nums text-slate-900'
  const iconCn = isDark ? 'h-4 w-4 text-white/90' : 'h-4 w-4 text-brand'
  const subtitleCn = isDark ? 'text-[10px] text-white/60 mt-0.5' : 'text-[10px] text-slate-500 mt-0.5'

  const friendsLabel = t?.('stage1315_metricFriendsLabel') || 'Приглашённые'
  const partnersLabel = t?.('stage1315_metricPartnersLabel') || 'Партнёры для % вывода'

  const showExtended = teamEarningsThb != null || retentionRatePercent != null
  const gridCols = showExtended ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'

  return (
    <div className={`grid ${gridCols} gap-3 ${className}`}>
      <div className={cardCn}>
        <p className={`${labelCn} inline-flex items-center gap-0.5 flex-wrap`}>
          {friendsLabel}
          <PartnerMetricsTooltip
            axis={PARTNER_METRICS_AXES.L1_INVITES}
            t={t}
            iconClassName={isDark ? 'text-white/70 hover:text-white' : undefined}
          />
        </p>
        <p className={`${valueCn} flex items-center gap-1.5 mt-0.5`}>
          <Users className={iconCn} aria-hidden />
          {friends}
        </p>
        <p className={subtitleCn}>{t?.('referralGlossary_l1Invites_subtitle')}</p>
      </div>
      <div className={cardCn}>
        <p className={`${labelCn} inline-flex items-center gap-0.5 flex-wrap`}>
          {partnersLabel}
          <PartnerMetricsTooltip
            axis={PARTNER_METRICS_AXES.WITHDRAW_TIER}
            t={t}
            iconClassName={isDark ? 'text-white/70 hover:text-white' : undefined}
          />
        </p>
        <p className={`${valueCn} flex items-center gap-1.5 mt-0.5`}>
          <UserCheck className={iconCn} aria-hidden />
          {partners}
        </p>
        <p className={subtitleCn}>{t?.('referralGlossary_withdrawTier_subtitle')}</p>
      </div>
        {teamEarningsThb != null ? (
          <div className={cardCn}>
            <p className={labelCn}>{t?.('stage133_teamEarningsLabel') || 'Доход команды'}</p>
            <p className={`${valueCn} flex items-center gap-1.5 mt-0.5 tabular-nums break-words`}>
              <ReferralLedgerAmount thb={teamEarningsThb} />
            </p>
          </div>
        ) : null}
        {retentionRatePercent != null ? (
          <div className={cardCn}>
            <p className={labelCn}>{t?.('stage133_retentionLabel') || 'Активность партнёров'}</p>
            <p className={`${valueCn} flex items-center gap-1.5 mt-0.5 tabular-nums`}>
              {Number(retentionRatePercent).toFixed(1)}%
            </p>
            <p className={subtitleCn}>
              {t?.('stage133_retentionTooltip') || 'Доля партнёров с хотя бы одним завершённым заказом'}
            </p>
          </div>
        ) : null}
      </div>
  )
}

export default ReferralTeamMetricsStrip
