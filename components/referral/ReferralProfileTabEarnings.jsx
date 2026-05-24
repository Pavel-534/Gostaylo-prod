'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Gift } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ReferralEarningsEstimator } from '@/components/referral/ReferralEarningsEstimator'
import { ReferralAmbassadorLevels } from '@/components/referral/ReferralAmbassadorLevels'
import { ReferralBadgesGrid } from '@/components/referral/ReferralBadgesGrid'
import { ReferralMonthlyGoalCard } from '@/components/referral/ReferralMonthlyGoalCard'
import { ReferralYourStatusCard } from '@/components/referral/ReferralYourStatusCard'
import { ReferralMiniSparkline } from '@/components/referral/ReferralMiniSparkline'

function formatThb(value, locale = 'ru-RU') {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString(locale, { maximumFractionDigits: 2 })
}

export function ReferralProfileTabEarnings({ data, walletData, t, locale }) {
  const router = useRouter()
  const walletTotal = Number(walletData?.wallet?.balance_thb || 0)
  const pending = Number(data?.stats?.expectedPendingThb || 0)
  const totalReferrals = Number(data?.stats?.friendsInvited || 0)
  const l1Monthly = Number(data?.stats?.monthlyL1EarnedThb || 0)
  const l2Monthly = Number(data?.stats?.monthlyNetworkEarnedThb || 0)
  const directPartnersInvited = Number(data?.stats?.directPartnersInvited ?? data?.ambassador?.directPartnersInvited ?? 0)
  const withdrawableThb = Number(walletData?.wallet?.withdrawable_balance_thb || 0)
  const payoutEligible = walletData?.payout?.payoutEligible === true
  const tierProgress = Number(data?.ambassador?.tierProgressPercent || 0)

  const ambassadorLevels = useMemo(() => {
    const tiers = Array.isArray(data?.ambassador?.tiers) ? data.ambassador.tiers : []
    const currentId = data?.ambassador?.currentTier?.id
    return tiers.slice(0, 3).map((tier, idx) => ({
      level: idx + 1,
      id: tier.id,
      name: tier.name,
      minPartnersInvited: Number(tier.minPartnersInvited || 0),
      unlocked: directPartnersInvited >= Number(tier.minPartnersInvited || 0),
      isCurrent: String(tier.id) === String(currentId),
    }))
  }, [data?.ambassador, directPartnersInvited])

  return (
    <div className="space-y-6">
      <ReferralYourStatusCard
        t={t}
        locale={locale}
        ambassador={data?.ambassador}
        badgesEarned={data?.referralGamification?.badgesEarned}
        brandName={data?.brandName}
        displayName={data?.marketingCard?.displayName}
        turboMultiplier={data?.turbo?.enabled ? data?.turbo?.promoBoostPerBookingThb : 1}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReferralMonthlyGoalCard
          monthlyEarnedThb={data?.stats?.monthlyEarnedThb}
          monthlyGoalThb={data?.stats?.monthlyGoalThb}
          monthlyGoalProgressPercent={data?.stats?.monthlyGoalProgressPercent}
          turboEnabled={data?.turbo?.enabled}
          t={t}
          locale={locale}
        />
        <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t('stage1143_badgesTitle')}</CardTitle>
            <CardDescription>{t('stage1143_badgesSubtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ReferralBadgesGrid badgesEarned={data?.referralGamification?.badgesEarned} t={t} compact />
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{t('stage1143_publicLevelsCardTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ReferralAmbassadorLevels levels={ambassadorLevels} directPartnersInvited={directPartnersInvited} t={t} />
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <p className="text-xs uppercase tracking-wider text-slate-500">{t('stage1143_earningsTotal')}</p>
            <p className="text-4xl font-black text-brand mt-2">{formatThb(walletTotal, locale)} THB</p>
            <div className="mt-6 flex gap-8 flex-wrap">
              <div>
                <p className="text-xs text-slate-400">{t('stage1143_invitesTotal')}</p>
                <p className="text-2xl font-semibold">{totalReferrals}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">{t('stage1143_pending')}</p>
                <p className="text-2xl font-semibold text-slate-500">{formatThb(pending, locale)} THB</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">{t('stage1143_earnedLifetime')}</p>
                <p className="text-2xl font-semibold text-brand">{formatThb(data?.stats?.earnedThb, locale)} THB</p>
              </div>
            </div>
            {Array.isArray(data?.stats?.sparklineEarningsThb) && data.stats.sparklineEarningsThb.length > 1 ? (
              <div className="mt-6">
                <ReferralMiniSparkline values={data.stats.sparklineEarningsThb} />
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-brand/20 bg-brand text-white shadow-sm">
          <CardContent className="p-6 space-y-4">
            <Gift className="h-8 w-8" />
            <p className="text-xl font-bold">{data?.ambassador?.currentTier?.name || 'Ambassador'}</p>
            <Progress value={tierProgress} className="h-2 bg-white/20" />
            <Button
              type="button"
              variant="secondary"
              className="w-full bg-white text-brand"
              onClick={() => router.push('/profile/wallet')}
            >
              {payoutEligible
                ? t('stage1143_withdrawCta').replace('{amount}', formatThb(withdrawableThb, locale))
                : t('stage1143_tabNavWallet')}
            </Button>
          </CardContent>
        </Card>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('stage91_statsDirectGuests')}</CardTitle>
            <CardDescription>{t('stage91_statsDirectGuestsDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-brand">{formatThb(l1Monthly, locale)} THB</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('stage91_statsPartnerNetwork')}</CardTitle>
            <CardDescription>{t('stage91_statsPartnerNetworkDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-brand">{formatThb(l2Monthly, locale)} THB</p>
          </CardContent>
        </Card>
      </div>

      <ReferralEarningsEstimator referralEstimator={data?.referralEstimator} t={t} locale={locale} />
    </div>
  )
}
