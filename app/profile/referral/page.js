'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowRight, Coins, Copy, Gift, Loader2, Plane } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/auth-context'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { toast } from 'sonner'
import { useWalletMeQuery } from '@/lib/hooks/use-wallet-me'
import { ReferralMarketingKit } from '@/components/referral/ReferralMarketingKit'
import { ReferralActivitySection } from '@/components/referral/ReferralActivitySection'
import { ReferralEarningsEstimator } from '@/components/referral/ReferralEarningsEstimator'

function formatThb(value, locale = 'ru-RU') {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString(locale, { maximumFractionDigits: 2 })
}

export default function ReferralInvitePage() {
  const router = useRouter()
  const { language } = useI18n()
  const t = useMemo(() => (key, ctx) => getUIText(key, language, ctx), [language])
  const locale = language === 'en' ? 'en-US' : language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'ru-RU'
  const { isAuthenticated, loading: authLoading } = useAuth()
  const { data: walletData } = useWalletMeQuery({ enabled: !authLoading && isAuthenticated })

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      router.replace('/profile?login=true')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const refRes = await fetch('/api/v2/referral/me', { credentials: 'include', cache: 'no-store' })
        const json = await refRes.json().catch(() => ({}))
        if (!cancelled) {
          if (refRes.ok && json?.success) setData(json.data || null)
          else toast.error(json?.error || t('referralStage726_loadErr'))
        }
      } catch {
        if (!cancelled) toast.error(t('referralStage726_pageErr'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authLoading, isAuthenticated, router, t])

  async function copyText(value) {
    const v = String(value || '').trim()
    if (!v) return
    try {
      await navigator.clipboard.writeText(v)
      toast.success(t('referralStage726_linkCopied'))
    } catch {
      toast.error(t('referralStage726_copyFail'))
    }
  }

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <Card className="rounded-xl">
          <CardContent className="py-12 flex items-center justify-center text-slate-600">
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            {t('referralStage726_load')}
          </CardContent>
        </Card>
      </div>
    )
  }

  const displayName = String(data?.marketingCard?.displayName || '').trim() || 'Ambassador'
  const brand = String(data?.brandName || '').trim() || 'Platform'
  const inviteLink = String(data?.referralLandingUrl || data?.referralLink || '').trim()
  const welcomeCode = String(data?.code || '').trim() || 'AIR-XXXXXX'
  const directPartnersInvited = Number(data?.stats?.directPartnersInvited ?? data?.ambassador?.directPartnersInvited ?? 0)
  const l1Monthly = Number(data?.stats?.monthlyL1EarnedThb || 0)
  const l2Monthly = Number(data?.stats?.monthlyNetworkEarnedThb || 0)
  const walletTotal = Number(walletData?.wallet?.balance_thb || 0)
  const pending = Number(data?.stats?.expectedPendingThb || 0)
  const totalReferrals = Number(data?.stats?.friendsInvited || 0)
  const welcomeBonusThbRaw = Math.round(Number(walletData?.policy?.welcomeBonusAmount ?? 0))
  const welcomeBonusThb = Number.isFinite(welcomeBonusThbRaw) && welcomeBonusThbRaw > 0 ? welcomeBonusThbRaw : 500

  const inviteShareBody = String(t('stage91_shareBodyInvitee'))
    .replace(/\{welcomeThb\}/g, String(welcomeBonusThb))
    .replace(/\{link\}/g, inviteLink)

  return (
    <div className="min-h-screen bg-[#f7f9fb]">
      <div className="mx-auto max-w-6xl px-4 py-10 space-y-10">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/80 p-2 backdrop-blur-sm shadow-sm">
          <Button type="button" className="bg-[#006666] hover:bg-[#005757]" onClick={() => router.push('/profile/referral')}>
            Пригласить
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push('/profile/wallet')}>
            Кошелек
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push('/profile/status')}>
            Мой статус
          </Button>
        </div>

        <section className="space-y-3">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900">{t('stage91_inviteHeroTitle')}</h1>
          <p className="text-lg text-slate-600 max-w-3xl">{t('stage91_inviteHeroSubtitle')}</p>
          <p className="text-sm">
            <button
              type="button"
              className="text-[#006666] font-medium underline underline-offset-2 hover:text-[#005757]"
              onClick={() => router.push('/about/loyalty')}
            >
              {t('stage91_loyaltyHomeCta')}
            </button>
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900">{t('stage91_whyShareTitle')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="rounded-xl border border-teal-100 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-600 text-white shrink-0">
                  <Plane className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg leading-tight">{t('stage91_whyTravelersTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed text-slate-700">
                  {t('stage91_whyTravelersBody')}
                </CardDescription>
              </CardContent>
            </Card>
            <Card className="rounded-xl border border-emerald-100 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shrink-0">
                  <Coins className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg leading-tight">{t('stage91_whyPartnersTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed text-slate-700">{t('stage91_whyPartnersBody')}</CardDescription>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <ReferralActivitySection teamMembers={data?.teamMembers} t={t} />
          <ReferralEarningsEstimator referralEstimator={data?.referralEstimator} t={t} locale={locale} />
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm transition-all duration-300 hover:shadow-md">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-wider text-slate-500">Ваши доходы</p>
              <div className="flex items-end gap-2 mt-2">
                <p className="text-4xl font-black tracking-tight text-[#006666]">{formatThb(walletTotal, locale)} THB</p>
              </div>
              <div className="mt-6 flex gap-8">
                <div>
                  <p className="text-xs text-slate-400">Всего приглашений</p>
                  <p className="text-2xl font-semibold">{totalReferrals}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Ожидает</p>
                  <p className="text-2xl font-semibold text-slate-500">{formatThb(pending, locale)} THB</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl border border-[#006666]/20 bg-[#006666] text-white shadow-sm transition-all duration-300 hover:shadow-md">
            <CardContent className="p-6 space-y-3">
              <Gift className="h-8 w-8" />
              <p className="text-xl font-bold">Уровень Ambassadors</p>
              <p className="text-sm text-teal-100">
                Вам осталось {Math.max(0, 3 - directPartnersInvited)} активных партнера до следующего усиления.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
            <CardHeader>
              <CardTitle>Scan или Share</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="mx-auto w-fit rounded-xl border-2 border-dashed border-slate-200 p-4 bg-slate-50">
                {inviteLink ? <QRCodeSVG value={inviteLink} size={180} level="M" includeMargin /> : <div className="h-[180px] w-[180px] rounded bg-slate-100" />}
              </div>
              <div className="space-y-2">
                <p className="text-xs text-slate-500">Ваш код</p>
                <Input value={welcomeCode} readOnly className="font-semibold tracking-wide" />
                <p className="text-xs text-slate-500">Ваша ссылка</p>
                <div className="flex gap-2">
                  <Input value={inviteLink} readOnly />
                  <Button type="button" className="bg-[#006666] hover:bg-[#005757]" onClick={() => void copyText(inviteLink)}>
                    <Copy className="h-4 w-4 mr-1" />
                    Копировать
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-slate-800 bg-slate-900 text-white shadow-sm transition-all duration-300 hover:shadow-md">
            <CardHeader>
              <CardTitle>How it works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full border border-teal-400/30 bg-teal-400/20 text-teal-300 grid place-items-center font-bold">1</div>
                <div>
                  <p className="font-semibold">Share link</p>
                  <p className="text-sm text-slate-400">Отправьте ссылку в Telegram, WhatsApp и соцсети.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full border border-teal-400/30 bg-teal-400/20 text-teal-300 grid place-items-center font-bold">2</div>
                <div>
                  <p className="font-semibold">Friend books</p>
                  <p className="text-sm text-slate-400">Друг завершает первую бронь на платформе.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full border border-teal-400/30 bg-teal-400/20 text-teal-300 grid place-items-center font-bold">3</div>
                <div>
                  <p className="font-semibold">You get profit</p>
                  <p className="text-sm text-slate-400">Начисления попадают в кошелек автоматически по правилам PnL.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('stage91_statsDirectGuests')}</CardTitle>
              <CardDescription>{t('stage91_statsDirectGuestsDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-[#006666]">{formatThb(l1Monthly, locale)} THB</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('stage91_statsPartnerNetwork')}</CardTitle>
              <CardDescription>{t('stage91_statsPartnerNetworkDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-[#006666]">{formatThb(l2Monthly, locale)} THB</p>
            </CardContent>
          </Card>
        </section>

        <ReferralMarketingKit
          referralLink={data?.referralLink || ''}
          landingShareUrl={data?.referralLandingUrl || ''}
          landingShortLabel={data?.referralLandingShortDisplay || ''}
          loyaltyExplainerHref="/about/loyalty"
          loyaltyExplainerLabel={t('stage91_shareColdAudienceLoyaltyLink')}
          shareNativeLabel={t('stage91_shareNative')}
          welcomeBonusThb={welcomeBonusThb}
          shareBody={inviteShareBody}
          shareMessage={data?.shareMessage || ''}
          code={welcomeCode}
          brandName={brand}
          displayName={displayName}
          ambassadorBadge={data?.marketingCard?.ambassadorBadge || 'silver'}
          directPartnersInvitedCount={directPartnersInvited}
          storiesTeamLockedHint={t('stage75_storiesTeamLocked')}
          marketingTitle={t('stage73_marketingKitTitle')}
          marketingSubtitle={t('stage73_marketingKitSubtitle')}
          postTextsTitle={t('stage77_postTextsTitle')}
          postTextsSubtitle={t('stage77_postTextsSubtitle')}
          postTextShortLabel={t('stage77_postTextShortLabel')}
          postTextMediumLabel={t('stage77_postTextMediumLabel')}
          postTextLongLabel={t('stage77_postTextLongLabel')}
          postCopyLabel={t('stage77_postCopyLabel')}
          postCopiedToast={t('stage77_postCopiedToast')}
          postTextShortTemplate={t('stage77_postTextShortTemplate')}
          postTextMediumTemplate={t('stage77_postTextMediumTemplate')}
          postTextLongTemplate={t('stage77_postTextLongTemplate')}
          downloadLabel={t('stage73_downloadQr')}
          shareFbLabel={t('stage73_shareFb')}
          shareTgLabel={t('referralStage726_shareTg')}
          shareWaLabel={t('referralStage726_shareWa')}
        />

        <Card className="rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
          <CardContent className="p-4 text-sm text-slate-600 flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-[#006666]" />
            Для финансового контроля перейдите в <button className="font-medium text-[#006666] underline" onClick={() => router.push('/profile/wallet')}>Кошелек</button> и{' '}
            <button className="font-medium text-[#006666] underline" onClick={() => router.push('/profile/status')}>Мой статус</button>.
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
