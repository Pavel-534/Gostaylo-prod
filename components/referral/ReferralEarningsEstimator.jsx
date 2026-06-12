'use client'

import { useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { estimateReferrerIllustrationThb } from '@/lib/referral/referral-earnings-estimator'

function formatThb(value, locale = 'ru-RU') {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString(locale, { maximumFractionDigits: 0 })
}

/**
 * @param {{
 *   referralEstimator?: { welcomeBonusThb?: number, referralReinvestmentPercent?: number, referralSplitRatio?: number } | null,
 *   t: (key: string, ctx?: object) => string,
 *   locale?: string,
 * }} props
 */
export function ReferralEarningsEstimator({ referralEstimator, t, locale = 'ru-RU' }) {
  const welcome = Math.round(Number(referralEstimator?.welcomeBonusThb ?? 500)) || 500
  const reinvest = Math.min(95, Math.max(0, Number(referralEstimator?.referralReinvestmentPercent ?? 45)))
  const split = Math.min(
    1,
    Math.max(
      0,
      Number(
        referralEstimator?.referralSplitRatio ??
          (Number(referralEstimator?.ambassadorGuestPoolL1Percent ?? 45) / 100),
      ),
    ),
  )

  const [friends, setFriends] = useState([5])
  const [avgBooking, setAvgBooking] = useState([15000])

  const friendCount = friends[0] ?? 5
  const avgThb = avgBooking[0] ?? 15000

  const est = useMemo(
    () =>
      estimateReferrerIllustrationThb({
        friendCount,
        avgBookingThb: avgThb,
        referralReinvestmentPercent: reinvest,
        referralSplitRatio: split,
      }),
    [friendCount, avgThb, reinvest, split],
  )

  return (
    <Card className="rounded-xl border border-brand/20 bg-gradient-to-br from-white to-brand/10 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-brand" aria-hidden />
          <CardTitle className="text-xl">{t('stage91_estimatorTitle')}</CardTitle>
        </div>
        <CardDescription>{t('stage91_estimatorSubtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-xl border border-brand/25 bg-white/90 p-4 shadow-inner">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-hover/90">{t('stage91_estimatorOwnTripLabel')}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-brand">
            ฿{formatThb(welcome, locale)}
          </p>
          <p className="mt-2 text-xs text-slate-600 leading-snug">{t('stage91_estimatorOwnTripHint')}</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-sm">{t('stage91_estimatorFriends')}</Label>
            <span className="text-sm font-semibold tabular-nums text-slate-900">{friendCount}</span>
          </div>
          <Slider min={1} max={30} step={1} value={friends} onValueChange={setFriends} className="py-1" />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-sm">{t('stage91_estimatorAvg')}</Label>
            <span className="text-sm font-semibold tabular-nums text-slate-900">
              ฿{formatThb(avgThb, locale)}
            </span>
          </div>
          <Slider
            min={3000}
            max={80000}
            step={1000}
            value={avgBooking}
            onValueChange={setAvgBooking}
            className="py-1"
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <p className="text-xs text-slate-600">{t('stage91_estimatorFriendsBonusLabel')}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            ฿{formatThb(est.totalReferrerThb, locale)}
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{t('stage91_estimatorDisclaimer')}</p>
        </div>
      </CardContent>
    </Card>
  )
}
