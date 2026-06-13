'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ReferralMonthlyLeaderboard } from '@/components/referral/ReferralMonthlyLeaderboard'
import { ReferralMiniSparkline } from '@/components/referral/ReferralMiniSparkline'

function formatThb(value, locale = 'ru-RU') {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString(locale, { maximumFractionDigits: 2 })
}

/** Stage 132.1 — team analytics only; money history lives on /profile/wallet. */
export function ReferralProfileTabHistory({ data, t, locale }) {
  return (
    <div className="space-y-6">
      <ReferralMonthlyLeaderboard t={t} locale={locale} formatThb={(n) => formatThb(n, locale)} />

      {Array.isArray(data?.stats?.sparkMonthlyYtdThb) && data.stats.sparkMonthlyYtdThb.length > 1 ? (
        <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t('stage73_statYearlyEarned')}</CardTitle>
            <CardDescription>{t('stage73_referralStatsTzHint')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ReferralMiniSparkline values={data.stats.sparkMonthlyYtdThb} height={56} />
            <p className="text-2xl font-semibold text-brand mt-4 tabular-nums">
              {formatThb(data?.stats?.yearlyEarnedThb, locale)} THB
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
