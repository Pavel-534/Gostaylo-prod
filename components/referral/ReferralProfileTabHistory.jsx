'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ReferralMonthlyLeaderboard } from '@/components/referral/ReferralMonthlyLeaderboard'
import { ReferralMiniSparkline } from '@/components/referral/ReferralMiniSparkline'
import { ReferralLedgerAmount } from '@/components/referral/ReferralLedgerAmount'
import { useReferralLedgerDisplay } from '@/lib/hooks/use-referral-ledger-display'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
  MOBILE_FLAT_CARD_HEADER_CLASS,
} from '@/lib/ui/mobile-flat-canvas'

/** Stage 132.1 — team analytics only; money history lives on /profile/wallet. */
export function ReferralProfileTabHistory({ data, t, locale }) {
  const { formatThbAsDisplay } = useReferralLedgerDisplay()

  return (
    <div className="space-y-6">
      <ReferralMonthlyLeaderboard
        t={t}
        locale={locale}
        formatAmountLine={(amountThb) => formatThbAsDisplay(amountThb)}
      />

      {Array.isArray(data?.stats?.sparkMonthlyYtdThb) && data.stats.sparkMonthlyYtdThb.length > 1 ? (
        <Card className={MOBILE_FLAT_CARD_CLASS}>
          <CardHeader className={MOBILE_FLAT_CARD_HEADER_CLASS}>
            <CardTitle className="text-base">{t('stage73_statYearlyEarned')}</CardTitle>
            <CardDescription>{t('stage73_referralStatsTzHint')}</CardDescription>
          </CardHeader>
          <CardContent className={MOBILE_FLAT_CARD_CONTENT_CLASS}>
            <ReferralMiniSparkline values={data.stats.sparkMonthlyYtdThb} height={56} />
            <p className="text-2xl font-semibold text-brand mt-4 break-words">
              <ReferralLedgerAmount thb={data?.stats?.yearlyEarnedThb} />
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
