'use client'

import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LEADER_TIER_PALETTE } from '@/lib/config/leader-tier-thresholds.js'
import { cn } from '@/lib/utils'

/**
 * Stage 202.22 — 5-step community tier ladder (not withdraw % / not L1-L2-L3).
 *
 * @param {{
 *   currentTier: { id: string, i18nKey: string } | null,
 *   nextTier: { id: string, i18nKey: string } | null,
 *   progressPercent: number,
 *   missing: {
 *     qualifiedHosts?: number,
 *     completedBookingsAsHost?: number,
 *     earnedThb?: number,
 *     regionAssignment?: boolean,
 *   },
 *   t: (key: string, ctx?: object) => string,
 *   className?: string,
 * }} props
 */
export function LocalLeaderTier({
  currentTier,
  nextTier,
  progressPercent = 0,
  missing = {},
  t,
  className,
}) {
  if (!currentTier?.id) return null

  const palette = LEADER_TIER_PALETTE[currentTier.id] || LEADER_TIER_PALETTE.participant
  const hasMissing =
    (missing.qualifiedHosts ?? 0) > 0 ||
    (missing.completedBookingsAsHost ?? 0) > 0 ||
    (missing.earnedThb ?? 0) > 0 ||
    missing.regionAssignment === true

  return (
    <Card className={cn('gsl-card', className)} data-testid="local-leader-tier">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('localLeaderTier_title')}</CardTitle>
        <CardDescription className="text-xs leading-relaxed">{t('localLeaderTier_subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className={cn('rounded-2xl border border-slate-200/80 p-4', palette.bg)}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={cn('text-sm font-semibold', palette.text)}>{t(currentTier.i18nKey)}</span>
            {nextTier ? (
              <span className="text-xs text-slate-500">
                {t('localLeaderTier_nextLabel')} → {t(nextTier.i18nKey)}
              </span>
            ) : (
              <span className="text-xs text-slate-600">{t('localLeaderTier_maxTier')}</span>
            )}
          </div>

          {nextTier ? (
            <>
              <Progress value={Number(progressPercent) || 0} className="mt-3 h-2" />
              {hasMissing ? (
                <ul className="mt-3 space-y-1 text-xs text-slate-600">
                  {(missing.qualifiedHosts ?? 0) > 0 ? (
                    <li>{t('localLeaderTier_missing_hosts', { n: String(missing.qualifiedHosts) })}</li>
                  ) : null}
                  {(missing.completedBookingsAsHost ?? 0) > 0 ? (
                    <li>
                      {t('localLeaderTier_missing_bookings', { n: String(missing.completedBookingsAsHost) })}
                    </li>
                  ) : null}
                  {(missing.earnedThb ?? 0) > 0 ? (
                    <li>{t('localLeaderTier_missing_earned', { n: String(missing.earnedThb) })}</li>
                  ) : null}
                  {missing.regionAssignment ? (
                    <li>{t('localLeaderTier_missing_region')}</li>
                  ) : null}
                </ul>
              ) : null}
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

export default LocalLeaderTier
