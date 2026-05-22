'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/auth-context'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { toast } from 'sonner'
import { useWalletMeQuery } from '@/lib/hooks/use-wallet-me'
import { useReferralMeQuery } from '@/lib/hooks/use-referral-me'
import { ReferralProfileTabLink } from '@/components/referral/ReferralProfileTabLink'
import { ReferralProfileTabEarnings } from '@/components/referral/ReferralProfileTabEarnings'
import { ReferralProfileTabTeam } from '@/components/referral/ReferralProfileTabTeam'
import { ReferralProfileTabHistory } from '@/components/referral/ReferralProfileTabHistory'
import { ReferralProfileTabSettings } from '@/components/referral/ReferralProfileTabSettings'
import { ReferralWithdrawableStrip } from '@/components/referral/ReferralWithdrawableStrip'
import { ReferralPageSkeleton } from '@/components/referral/ReferralPageSkeleton'
import { ProfileHubNav } from '@/components/product/ProfileHubNav'
import { ProductPageShell } from '@/components/product/ProductPageShell'
import { PageSectionHeader } from '@/components/product/PageSectionHeader'

const TAB_ACTIVE =
  'rounded-lg shrink-0 snap-start data-[state=active]:bg-brand data-[state=active]:text-white'

/**
 * Stage 114.3 / 115.0 — `/profile/referral` с табами (useReferralMeQuery SSOT).
 */
export function ReferralProfilePage() {
  const router = useRouter()
  const { language } = useI18n()
  const t = useMemo(() => (key, ctx) => getUIText(key, language, ctx), [language])
  const locale = language === 'en' ? 'en-US' : language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'ru-RU'
  const { isAuthenticated, loading: authLoading } = useAuth()
  const { data: walletData, isLoading: walletLoading } = useWalletMeQuery({
    enabled: !authLoading && isAuthenticated,
  })
  const { data, isLoading: referralLoading, isError: referralError } = useReferralMeQuery({
    enabled: !authLoading && isAuthenticated,
    includeTeam: true,
    teamLimit: 100,
  })

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) router.replace('/profile?login=true')
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (referralError) toast.error(t('referralStage726_loadErr'))
  }, [referralError, t])

  if (authLoading || referralLoading) {
    return <ReferralPageSkeleton />
  }

  const welcomeBonusThbRaw = Math.round(Number(walletData?.policy?.welcomeBonusAmount ?? 0))
  const welcomeBonusThb = Number.isFinite(welcomeBonusThbRaw) && welcomeBonusThbRaw > 0 ? welcomeBonusThbRaw : 500

  return (
    <ProductPageShell>
      <ProfileHubNav t={t} />

      <PageSectionHeader title={t('stage91_inviteHeroTitle')} subtitle={t('stage91_inviteHeroSubtitle')} />

      <ReferralWithdrawableStrip walletData={walletData} t={t} locale={locale} loading={walletLoading} />

      <Tabs defaultValue="link" className="space-y-6">
        <TabsList className="flex w-full overflow-x-auto sm:flex-wrap h-auto gap-1 gsl-card p-1 shadow-sm scrollbar-thin snap-x snap-mandatory [-webkit-overflow-scrolling:touch]">
          <TabsTrigger value="link" className={TAB_ACTIVE}>
            {t('stage1143_tabLink')}
          </TabsTrigger>
          <TabsTrigger value="earnings" className={TAB_ACTIVE}>
            {t('stage1143_tabEarnings')}
          </TabsTrigger>
          <TabsTrigger value="team" className={TAB_ACTIVE}>
            {t('stage1143_tabTeam')}
          </TabsTrigger>
          <TabsTrigger value="history" className={TAB_ACTIVE}>
            {t('stage1143_tabHistory')}
          </TabsTrigger>
          <TabsTrigger value="settings" className={TAB_ACTIVE}>
            {t('stage1143_tabSettings')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="link">
          <ReferralProfileTabLink data={data} walletData={walletData} t={t} locale={locale} welcomeBonusThb={welcomeBonusThb} />
        </TabsContent>
        <TabsContent value="earnings">
          <ReferralProfileTabEarnings data={data} walletData={walletData} t={t} locale={locale} />
        </TabsContent>
        <TabsContent value="team">
          <ReferralProfileTabTeam data={data} t={t} locale={locale} />
        </TabsContent>
        <TabsContent value="history">
          <ReferralProfileTabHistory data={data} walletData={walletData} t={t} locale={locale} />
        </TabsContent>
        <TabsContent value="settings">
          <ReferralProfileTabSettings data={data} t={t} />
        </TabsContent>
      </Tabs>
    </ProductPageShell>
  )
}
