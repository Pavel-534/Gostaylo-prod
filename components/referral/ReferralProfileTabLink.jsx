'use client'

import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowRight, Coins, Copy, Plane } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ReferralMarketingKit } from '@/components/referral/ReferralMarketingKit'
import { ReferralAmbassadorWaveGuide } from '@/components/referral/ReferralAmbassadorWaveGuide'
import { toast } from 'sonner'

export function ReferralProfileTabLink({ data, walletData, t, locale, welcomeBonusThb }) {
  const router = useRouter()
  const displayName = String(data?.marketingCard?.displayName || '').trim() || 'Ambassador'
  const brand = String(data?.brandName || '').trim() || 'Platform'
  const inviteLink = String(data?.referralLandingUrl || data?.referralLink || '').trim()
  const welcomeCode = String(data?.code || '').trim() || 'AIR-XXXXXX'
  const directPartnersInvited = Number(data?.stats?.directPartnersInvited ?? data?.ambassador?.directPartnersInvited ?? 0)
  const stories = data?.referralStoriesCopy || {}
  const storiesCardHeadline = String(t('stage73_storiesCardHeadline')).replace(/\{brand\}/g, brand)
  const tierName = String(stories.tierName || data?.ambassador?.currentTier?.name || '').trim()
  const badgeFromStories = String(stories.ambassadorBadgeLine || '').replace(/^🏆\s*/, '').trim()
  const storiesTierStatusLine = String(t('stage74_storiesTierLine'))
    .replace(/\{brand\}/g, brand)
    .replace(/\{tier\}/g, tierName || '—')
    .replace(/\{badge\}/g, badgeFromStories || '—')
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

  return (
    <div className="space-y-8">
      <ReferralAmbassadorWaveGuide t={t} />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">{t('stage91_whyShareTitle')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="rounded-xl border border-brand/20 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand text-white shrink-0">
                <Plane className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">{t('stage91_whyTravelersTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-slate-700">{t('stage91_whyTravelersBody')}</CardDescription>
            </CardContent>
          </Card>
          <Card className="rounded-xl border border-emerald-100 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shrink-0">
                <Coins className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">{t('stage91_whyPartnersTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-slate-700">{t('stage91_whyPartnersBody')}</CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>{t('stage1143_qrCardTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="mx-auto w-fit rounded-xl border-2 border-dashed border-slate-200 p-4 bg-slate-50">
              {inviteLink ? (
                <QRCodeSVG value={inviteLink} size={180} level="M" includeMargin />
              ) : (
                <div className="h-[180px] w-[180px] rounded bg-slate-100" />
              )}
            </div>
            <div className="space-y-2">
              <p className="text-xs text-slate-500">{t('stage1143_yourCode')}</p>
              <Input value={welcomeCode} readOnly className="font-semibold tracking-wide" />
              <p className="text-xs text-slate-500">{t('stage1143_yourLink')}</p>
              <div className="flex gap-2">
                <Input value={inviteLink} readOnly />
                <Button type="button" variant="brand" onClick={() => void copyText(inviteLink)}>
                  <Copy className="h-4 w-4 mr-1" />
                  {t('stage1143_copyLink')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-slate-800 bg-slate-900 text-white shadow-sm">
          <CardHeader>
            <CardTitle>{t('stage1143_howItWorks')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-sm text-slate-400">
            <p>{t('stage1143_howStep1')}</p>
            <p>{t('stage1143_howStep2')}</p>
            <p>{t('stage1143_howStep3')}</p>
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
        sharePitchTabGuestLabel={t('stage1322_shareTabGuests')}
        sharePitchTabHostLabel={t('stage1322_shareTabHosts')}
        shareBody={t('stage1322_shareBodyGuest')}
        shareBodyHost={t('stage1322_shareBodyHost')}
        postTextShortHostTemplate={t('stage1322_postShortHost')}
        postTextMediumHostTemplate={t('stage1322_postMediumHost')}
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
        storiesCardHeadline={storiesCardHeadline}
        storiesTierStatusLine={storiesTierStatusLine}
        storiesAmbassadorBadgeLine={stories.ambassadorBadgeLine || ''}
        storiesTeamHeadline={stories.teamHeadline || ''}
        storiesTeamAmountLine={stories.teamAmountLine || ''}
        storiesTeamCtaLine={stories.teamCtaLine || ''}
      />

      <Card className="rounded-xl border border-slate-200 bg-white">
        <CardContent className="p-4 text-sm text-slate-600 flex items-center gap-2">
          <ArrowRight className="h-4 w-4 text-brand" />
          <span>
            {t('stage1143_walletHint')}{' '}
            <button type="button" className="font-medium text-brand underline" onClick={() => router.push('/profile/wallet')}>
              {t('stage1143_tabNavWallet')}
            </button>
          </span>
        </CardContent>
      </Card>
    </div>
  )
}
