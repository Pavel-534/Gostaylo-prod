'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowRight, Coins, Copy, Plane } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ReferralMarketingKit } from '@/components/referral/ReferralMarketingKit'
import { ReferralAmbassadorWaveGuide } from '@/components/referral/ReferralAmbassadorWaveGuide'
import {
  AMBASSADOR_UTM_CHANNELS,
  buildAmbassadorUtmLink,
} from '@/lib/referral/ambassador-utm-link'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const CHANNEL_LABEL_KEYS = {
  telegram: 'stage192_utmChannelTelegram',
  instagram: 'stage192_utmChannelInstagram',
  youtube: 'stage192_utmChannelYoutube',
  vk: 'stage192_utmChannelVk',
}

/**
 * Stage 192.0 — Link tab + Creator Pack UTM channel chips (presentation-only).
 */
export function ReferralProfileTabLink({ data, walletData, t, locale, welcomeBonusThb }) {
  const router = useRouter()
  const [utmChannel, setUtmChannel] = useState('telegram')
  const displayName = String(data?.marketingCard?.displayName || '').trim() || 'Ambassador'
  const brand = String(data?.brandName || '').trim() || 'Platform'
  const baseInviteLink = String(data?.referralLandingUrl || data?.referralLink || '').trim()
  const welcomeCode = String(data?.code || '').trim() || 'AIR-XXXXXX'
  const campaignId = String(data?.code || data?.userId || data?.id || 'ambassador')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 64) || 'ambassador'

  const taggedInviteLink = useMemo(
    () =>
      buildAmbassadorUtmLink(baseInviteLink, {
        channel: utmChannel,
        campaign: campaignId,
      }) || baseInviteLink,
    [baseInviteLink, utmChannel, campaignId],
  )

  const directPartnersInvited = Number(
    data?.stats?.directPartnersInvited ?? data?.ambassador?.directPartnersInvited ?? 0,
  )
  const stories = data?.referralStoriesCopy || {}
  const storiesCardHeadline = String(t('stage73_storiesCardHeadline')).replace(/\{brand\}/g, brand)
  const tierName = String(stories.tierName || data?.ambassador?.currentTier?.name || '').trim()
  const badgeFromStories = String(stories.ambassadorBadgeLine || '').replace(/^🏆\s*/, '').trim()
  const storiesTierStatusLine = String(t('stage74_storiesTierLine'))
    .replace(/\{brand\}/g, brand)
    .replace(/\{tier\}/g, tierName || '—')
    .replace(/\{badge\}/g, badgeFromStories || '—')

  async function copyText(value, successKey = 'referralStage726_linkCopied') {
    const v = String(value || '').trim()
    if (!v) return
    try {
      await navigator.clipboard.writeText(v)
      toast.success(t(successKey))
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
            <CardDescription className="text-slate-600">{t('stage192_creatorPackTitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="mx-auto w-fit rounded-xl border-2 border-dashed border-slate-200 p-4 bg-slate-50">
              {taggedInviteLink ? (
                <QRCodeSVG value={taggedInviteLink} size={180} level="M" includeMargin />
              ) : (
                <div className="h-[180px] w-[180px] rounded bg-slate-100" />
              )}
            </div>
            <div className="space-y-2">
              <p className="text-xs text-slate-500">{t('stage1143_yourCode')}</p>
              <Input value={welcomeCode} readOnly className="font-semibold tracking-wide" />

              <div className="space-y-2 pt-1" data-testid="referral-utm-builder">
                <p className="text-sm font-medium text-slate-900">{t('stage192_utmBuilderTitle')}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{t('stage192_utmBuilderHint')}</p>
                <div className="flex flex-wrap gap-2">
                  {AMBASSADOR_UTM_CHANNELS.map((ch) => {
                    const selected = utmChannel === ch
                    return (
                      <button
                        key={ch}
                        type="button"
                        data-testid={`referral-utm-channel-${ch}`}
                        aria-pressed={selected}
                        onClick={() => setUtmChannel(ch)}
                        className={cn(
                          'inline-flex min-h-11 items-center rounded-full border px-3.5 text-sm font-medium transition',
                          selected
                            ? 'border-brand bg-brand text-white shadow-sm'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-brand/40 hover:bg-brand/5',
                        )}
                      >
                        {t(CHANNEL_LABEL_KEYS[ch])}
                      </button>
                    )
                  })}
                </div>
              </div>

              <p className="text-xs text-slate-500">{t('stage1143_yourLink')}</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={taggedInviteLink}
                  readOnly
                  className="min-w-0 text-xs sm:text-sm"
                  data-testid="referral-utm-link-input"
                />
                <Button
                  type="button"
                  variant="brand"
                  className="min-h-11 shrink-0 w-full sm:w-auto"
                  data-testid="referral-utm-copy"
                  onClick={() => void copyText(taggedInviteLink, 'stage192_utmCopied')}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  {t('stage192_utmCopyLink')}
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
        referralLink={
          buildAmbassadorUtmLink(String(data?.referralLink || '').trim(), {
            channel: utmChannel,
            campaign: campaignId,
          }) ||
          data?.referralLink ||
          ''
        }
        landingShareUrl={taggedInviteLink || data?.referralLandingUrl || ''}
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
            <button
              type="button"
              className="font-medium text-brand underline min-h-11 inline-flex items-center"
              onClick={() => router.push('/profile/wallet')}
            >
              {t('stage1143_tabNavWallet')}
            </button>
          </span>
        </CardContent>
      </Card>
    </div>
  )
}
