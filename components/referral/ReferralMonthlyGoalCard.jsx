'use client'

import { useMemo } from 'react'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Target, Zap } from 'lucide-react'
import { useReferralLedgerDisplay } from '@/lib/hooks/use-referral-ledger-display'

/**
 * Stage 179.7 — monthly goal: header currency + mid FX (payout parity).
 *
 * @param {{
 *   monthlyEarnedThb?: number,
 *   monthlyGoalThb?: number,
 *   monthlyGoalProgressPercent?: number,
 *   turboEnabled?: boolean,
 *   t: (k: string, ctx?: object) => string,
 *   locale?: string,
 * }} props
 */
export function ReferralMonthlyGoalCard({
  monthlyEarnedThb = 0,
  monthlyGoalThb = 10000,
  monthlyGoalProgressPercent = 0,
  turboEnabled = false,
  t,
}) {
  const { isConvertedDisplay, formatThbAsDisplay } = useReferralLedgerDisplay()

  const goal = Math.max(1, Number(monthlyGoalThb) || 10000)
  const current = Number(monthlyEarnedThb) || 0
  const pct = Math.min(100, Number(monthlyGoalProgressPercent) || Math.round((current / goal) * 100))
  const goalMet = pct >= 100

  const { currentAmount, goalAmount } = useMemo(() => {
    return {
      currentAmount: formatThbAsDisplay(current),
      goalAmount: formatThbAsDisplay(goal),
    }
  }, [current, goal, formatThbAsDisplay])

  return (
    <Card className="rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50/50 to-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-violet-600" />
          {t('stage73_monthlyGoalTitle')}
        </CardTitle>
        <CardDescription>
          {t('stage73_monthlyGoalProgress', { currentAmount, goalAmount })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={pct} className="h-2.5" />
        <p className="text-xs text-slate-600">
          {t('stage73_monthlyGoalPercentLine', { goalAmount, percent: String(Math.round(pct)) })}
        </p>
        {isConvertedDisplay ? (
          <p className="text-[10px] text-slate-500 leading-snug">{t('stage1797_midFxHint')}</p>
        ) : null}
        {goalMet ? (
          <div className="flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50/80 px-3 py-2 text-sm text-violet-950">
            <Zap className="h-4 w-4 shrink-0 text-violet-600 mt-0.5" />
            <p>{t('stage1143_monthlyGoalRewardHint')}</p>
          </div>
        ) : turboEnabled ? (
          <p className="text-xs text-slate-500">{t('stage1143_monthlyGoalTurboActive')}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
