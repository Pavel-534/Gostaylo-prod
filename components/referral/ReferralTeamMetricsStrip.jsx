'use client'

import { Users, UserCheck } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * Stage 131.5 — честное разделение метрик команды (SSOT).
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
    ? 'rounded-xl bg-white/10 backdrop-blur px-3 py-2.5 border border-white/15 cursor-help'
    : 'rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 cursor-help'
  const labelCn = isDark
    ? 'text-[10px] uppercase tracking-wide text-white/75'
    : 'text-[10px] uppercase tracking-wide text-slate-500'
  const valueCn = isDark ? 'text-xl font-bold tabular-nums text-white' : 'text-2xl font-bold tabular-nums text-slate-900'
  const iconCn = isDark ? 'h-4 w-4 text-white/90' : 'h-4 w-4 text-brand'

  const friendsLabel = t?.('stage1315_metricFriendsLabel') || 'Приглашённые друзья'
  const friendsTip =
    t?.('stage1315_metricFriendsTooltip') ||
    'Все, кто зарегистрировался по вашему коду — гости и будущие хосты. Не влияет напрямую на уровень амбассадора.'
  const partnersLabel = t?.('stage1315_metricPartnersLabel') || 'Активные партнёры'
  const partnersTip =
    t?.('stage1315_metricPartnersTooltip') ||
    'Активированные хосты в вашей прямой команде. Именно они повышают уровень (Beginner → Pro → Ambassador) и долю к выводу.'

  const showExtended = teamEarningsThb != null || retentionRatePercent != null
  const gridCols = showExtended ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'

  return (
    <TooltipProvider delayDuration={200}>
      <div className={`grid ${gridCols} gap-3 ${className}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cardCn}>
              <p className={labelCn}>{friendsLabel}</p>
              <p className={`${valueCn} flex items-center gap-1.5 mt-0.5`}>
                <Users className={iconCn} aria-hidden />
                {friends}
              </p>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs text-xs">
            {friendsTip}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cardCn}>
              <p className={labelCn}>{partnersLabel}</p>
              <p className={`${valueCn} flex items-center gap-1.5 mt-0.5`}>
                <UserCheck className={iconCn} aria-hidden />
                {partners}
              </p>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs text-xs">
            {partnersTip}
          </TooltipContent>
        </Tooltip>
        {teamEarningsThb != null ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cardCn}>
                <p className={labelCn}>{t?.('stage133_teamEarningsLabel') || 'Доход команды'}</p>
                <p className={`${valueCn} flex items-center gap-1.5 mt-0.5 tabular-nums`}>
                  {Math.round(Number(teamEarningsThb) * 100) / 100}
                </p>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-xs">
              {t?.('stage133_teamEarningsTooltip') || 'За текущий период (L1 + L2), THB'}
            </TooltipContent>
          </Tooltip>
        ) : null}
        {retentionRatePercent != null ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cardCn}>
                <p className={labelCn}>{t?.('stage133_retentionLabel') || 'Retention хостов'}</p>
                <p className={`${valueCn} flex items-center gap-1.5 mt-0.5 tabular-nums`}>
                  {Number(retentionRatePercent).toFixed(1)}%
                </p>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-xs">
              {t?.('stage133_retentionTooltip') ||
                'Доля прямых партнёров-хостов с хотя бы одной завершённой бронью'}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </TooltipProvider>
  )
}

export default ReferralTeamMetricsStrip
