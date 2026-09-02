'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
  MOBILE_FLAT_CARD_HEADER_CLASS,
} from '@/lib/ui/mobile-flat-canvas'
import { ReferralMonthlyGoalCard } from '@/components/referral/ReferralMonthlyGoalCard'
import { ReferralMiniSparkline } from '@/components/referral/ReferralMiniSparkline'
import { ReferralLedgerAmount } from '@/components/referral/ReferralLedgerAmount'
import { ReferralLegalFootnotes } from '@/components/referral/ReferralLegalFootnotes'
import { useReferralLedgerDisplay } from '@/lib/hooks/use-referral-ledger-display'
import { isSimpleReferralPublicMode } from '@/lib/compliance/referral-public-mode.js'

export function ReferralProfileTabEarnings({ data, walletData, t, locale }) {
  const router = useRouter()
  const referralPublicSimple = isSimpleReferralPublicMode()
  const { formatLedgerWithApprox } = useReferralLedgerDisplay()
  const walletTotal = Number(walletData?.wallet?.balance_thb || 0)
  const pending = Number(data?.stats?.expectedPendingThb || 0)
  const l1Monthly = Number(data?.stats?.monthlyL1EarnedThb || 0)
  const l2Monthly = Number(data?.stats?.monthlyNetworkEarnedThb || 0)
  const withdrawableThb = Number(walletData?.wallet?.withdrawable_balance_thb || 0)
  const payoutEligible = walletData?.payout?.payoutEligible === true
  // Hero renders progress & status — this tab keeps ledger math/transactions.

  const withdrawCtaLabel = useMemo(() => {
    if (!payoutEligible) return t('stage1143_tabNavWallet')
    return t('stage1143_withdrawCta', { amount: formatLedgerWithApprox(withdrawableThb) })
  }, [payoutEligible, t, formatLedgerWithApprox, withdrawableThb])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReferralMonthlyGoalCard
          monthlyEarnedThb={data?.stats?.monthlyEarnedThb}
          monthlyGoalThb={data?.stats?.monthlyGoalThb}
          monthlyGoalProgressPercent={data?.stats?.monthlyGoalProgressPercent}
          turboEnabled={data?.turbo?.enabled}
          t={t}
          locale={locale}
        />
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className={cn(MOBILE_FLAT_CARD_CLASS, 'md:col-span-3')}>
          <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'sm:p-6')}>
            <p className="text-xs uppercase tracking-wider text-slate-500">{t('stage1143_earningsTotal')}</p>
            <p className="text-4xl font-black text-brand mt-2 break-words">
              <ReferralLedgerAmount thb={walletTotal} />
            </p>
            <div className="mt-6 flex gap-8 flex-wrap">
              <div>
                <p className="text-xs text-slate-400">{t('stage1143_pending')}</p>
                <p className="text-2xl font-semibold text-slate-500 break-words">
                  <ReferralLedgerAmount thb={pending} />
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">{t('stage1143_earnedLifetime')}</p>
                <p className="text-2xl font-semibold text-brand break-words">
                  <ReferralLedgerAmount thb={data?.stats?.earnedThb} />
                </p>
              </div>
            </div>
            {Array.isArray(data?.stats?.sparklineEarningsThb) && data.stats.sparklineEarningsThb.length > 1 ? (
              <div className="mt-6">
                <ReferralMiniSparkline values={data.stats.sparklineEarningsThb} />
              </div>
            ) : null}

              <div className="mt-6">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full bg-white text-brand min-h-[44px]"
                  onClick={() => router.push('/profile/wallet')}
                >
                  {withdrawCtaLabel}
                </Button>
              </div>
          </CardContent>
        </Card>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className={MOBILE_FLAT_CARD_CLASS}>
          <CardHeader className={cn(MOBILE_FLAT_CARD_HEADER_CLASS, 'sm:pb-2')}>
            <CardTitle className="text-base">{t('stage91_statsDirectGuests')}</CardTitle>
            <CardDescription>{t('stage91_statsDirectGuestsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className={MOBILE_FLAT_CARD_CONTENT_CLASS}>
            <p className="text-2xl font-semibold text-brand break-words">
              <ReferralLedgerAmount thb={l1Monthly} />
            </p>
          </CardContent>
        </Card>
        {!referralPublicSimple ? (
          <Card className={MOBILE_FLAT_CARD_CLASS}>
            <CardHeader className={cn(MOBILE_FLAT_CARD_HEADER_CLASS, 'sm:pb-2')}>
              <CardTitle className="text-base">{t('stage91_statsPartnerNetwork')}</CardTitle>
              <CardDescription>{t('stage91_statsPartnerNetworkDesc')}</CardDescription>
            </CardHeader>
            <CardContent className={MOBILE_FLAT_CARD_CONTENT_CLASS}>
              <p className="text-2xl font-semibold text-brand break-words">
                <ReferralLedgerAmount thb={l2Monthly} />
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <ReferralLegalFootnotes
        t={t}
        brandName={data?.brandName}
        monthlyInviteLimit={data?.referralEstimator?.referralMonthlyLimitPerUser}
      />
    </div>
  )
}
