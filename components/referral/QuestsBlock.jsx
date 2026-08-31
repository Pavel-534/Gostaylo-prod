'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ReferralLedgerAmount } from '@/components/referral/ReferralLedgerAmount'
import { cn } from '@/lib/utils'
import { CheckCircle2, Circle } from 'lucide-react'

/**
 * @param {{
 *   quests: Array<{
 *     id: string,
 *     titleKey: string,
 *     rewardThb: number,
 *     conditionMet?: boolean,
 *     status?: string,
 *   }>,
 *   t: (key: string, ctx?: object) => string,
 *   className?: string,
 * }} props
 */
export function QuestsBlock({ quests = [], t, className }) {
  const rows = Array.isArray(quests) ? quests : []
  if (!rows.length) return null

  return (
    <Card className={cn('gsl-card', className)} data-testid="leader-quests-block">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('leaderQuests_title')}</CardTitle>
        <CardDescription className="text-xs">{t('leaderQuests_subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {rows.map((q) => {
            const met = q.conditionMet === true || q.status === 'condition_met'
            return (
              <li
                key={q.id}
                className={cn(
                  'flex min-h-[44px] items-center justify-between gap-3 rounded-xl border px-3 py-2',
                  met ? 'border-emerald-200/80 bg-emerald-50/40' : 'border-slate-200 bg-white',
                )}
              >
                <div className="flex min-w-0 items-start gap-2">
                  {met ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                  )}
                  <div className="min-w-0">
                    <span
                      className={cn('text-sm leading-snug', met ? 'text-slate-500 line-through' : 'text-slate-800')}
                    >
                      {t(q.titleKey)}
                    </span>
                    {met ? (
                      <p className="text-[11px] text-emerald-700">{t('leaderQuests_status_met')}</p>
                    ) : null}
                  </div>
                </div>
                <span className="shrink-0 text-xs font-medium text-emerald-700 tabular-nums">
                  {t('leaderQuests_rewardUpTo')}{' '}
                  <ReferralLedgerAmount thb={q.rewardThb} className="inline font-semibold" />
                </span>
              </li>
            )
          })}
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">{t('leaderQuests_disclaimer')}</p>
      </CardContent>
    </Card>
  )
}

export default QuestsBlock
