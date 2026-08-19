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
  formatAmbassadorLinkCaption,
  formatAmbassadorShareLink,
} from '@/lib/referral/ambassador-utm-link'
import { cn } from '@/lib/utils'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
  MOBILE_FLAT_CARD_HEADER_CLASS,
} from '@/lib/ui/mobile-flat-canvas'
import { toast } from 'sonner'
import { localizeReferralTierName } from '@/lib/referral/localize-referral-tier-name'

const CHANNEL_LABEL_KEYS = {
  telegram: 'stage192_utmChannelTelegram',
  instagram: 'stage192_utmChannelInstagram',
  youtube: 'stage192_utmChannelYoutube',
  vk: 'stage192_utmChannelVk',
}

/**
 * Stage 192.0 — Link tab + Creator Pack UTM channel chips.
 * Stage 200.10 — clean display/share links; UTM only on channel copy.
 */
export function ReferralProfileTabLink({ data, walletData, t, locale, welcomeBonusThb }) {
  const router = useRouter()
  const [utmChannel, setUtmChannel] = useState('telegram')
  const displayName = String(data?.marketingCard?.displayName || '').trim() || 'Ambassador'
  const brand = String(data?.brandName || '').trim() || 'Platform'
  const welcomeCode = String(data?.code || '').trim() || 'AIR-XXXXXX'
  const campaignId = String(data?.code || data?.userId || data?.id || 'ambassador')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 64) || 'ambassador'

  /** Prefer vanity `/go`, then `/u` landing, then legacy `?ref=`. */
  const cleanInviteLink = useMemo(() => {
    const preferred = String(
      data?.vanityUrl || data?.referralLandingUrl || data?.referralLink || '',
    ).trim()
    return formatAmbassadorShareLink(preferred) || preferred
  }, [data?.vanityUrl, data?.referralLandingUrl, data?.referralLink])

  const displayLinkCaption = useMemo(() => {
    if (data?.vanityUrl) return formatAmbassadorLinkCaption(data.vanityUrl)
    const short = String(data?.referralLandingShortDisplay || '').trim()
    if (short) return short
    return formatAmbassadorLinkCaption(cleanInviteLink)
  }, [data?.vanityUrl, data?.referralLandingShortDisplay, cleanInviteLink])

  const taggedInviteLink = useMemo(
    () =>
      buildAmbassadorUtmLink(cleanInviteLink, {
        channel: utmChannel,
        campaign: campaignId,
      }) || cleanInviteLink,
    [cleanInviteLink, utmChannel, campaignId],
  )

  const directPartnersInvited = Number(
    data?.stats?.directPartnersInvited ?? data?.ambassador?.directPartnersInvited ?? 0,
  )
  const stories = data?.referralStoriesCopy || {}
  const storiesCardHeadline = String(t('stage73_storiesCardHeadline')).replace(/\{brand\}/g, brand)
  const tierName = localizeReferralTierName(
    stories.tierName || data?.ambassador?.currentTier?.name,
    t,
  )
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className={cn(MOBILE_FLAT_CARD_CLASS, 'sm:border-brand/20')}>
            <CardHeader className={cn(MOBILE_FLAT_CARD_HEADER_CLASS, 'flex flex-row items-center gap-3 space-y-0 sm:pb-2')}>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand text-white">
                <Plane className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">{t('stage91_whyTravelersTitle')}</CardTitle>
            </CardHeader>
            <CardContent className={MOBILE_FLAT_CARD_CONTENT_CLASS}>
              <CardDescription className="text-slate-700">{t('stage91_whyTravelersBody')}</CardDescription>
            </CardContent>
          </Card>
          <Card className={cn(MOBILE_FLAT_CARD_CLASS, 'sm:border-emerald-100')}>
            <CardHeader className={cn(MOBILE_FLAT_CARD_HEADER_CLASS, 'flex flex-row items-center gap-3 space-y-0 sm:pb-2')}>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                <Coins className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">{t('stage91_whyPartnersTitle')}</CardTitle>
            </CardHeader>
            <CardContent className={MOBILE_FLAT_CARD_CONTENT_CLASS}>
              <CardDescription className="text-slate-700">{t('stage91_whyPartnersBody')}</CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Card className={MOBILE_FLAT_CARD_CLASS}>
          <CardHeader className={MOBILE_FLAT_CARD_HEADER_CLASS}>
            <CardTitle>{t('stage1143_qrCardTitle')}</CardTitle>
            <CardDescription className="text-slate-600">{t('stage192_creatorPackTitle')}</CardDescription>
          </CardHeader>
          <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'space-y-4')}>
            <div className="mx-auto w-fit rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-4">
              {cleanInviteLink ? (
                <QRCodeSVG value={cleanInviteLink} size={180} level="M" includeMargin />
              ) : (
                <div className="h-[180px] w-[180px] rounded bg-slate-100" />
              )}
            </div>
            {displayLinkCaption ? (
              <p
                className="break-all text-center text-xs font-medium text-slate-600"
                data-testid="referral-qr-caption"
              >
                {displayLinkCaption}
              </p>
            ) : null}
            <div className="space-y-2">
              <p className="text-xs text-slate-500">{t('stage1143_yourCode')}</p>
              <Input value={welcomeCode} readOnly className="font-semibold tracking-wide" />

              <div className="space-y-2 pt-1" data-testid="referral-utm-builder">
                <p className="text-sm font-medium text-slate-900">{t('stage192_utmBuilderTitle')}</p>
                <p className="text-xs leading-relaxed text-slate-500">{t('stage192_utmBuilderHint')}</p>
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
              <div
                className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                data-testid="referral-utm-link-input"
              >
                <p className="break-all text-sm font-medium leading-snug text-slate-900">
                  {displayLinkCaption || cleanInviteLink}
                </p>
                <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
                  {t('stage200_linkDisplayHint')}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 w-full shrink-0 sm:w-auto"
                  data-testid="referral-clean-copy"
                  onClick={() => void copyText(cleanInviteLink, 'referralStage726_linkCopied')}
                >
                  <Copy className="mr-1 h-4 w-4" />
                  {t('stage200_copyCleanLink')}
                </Button>
                <Button
                  type="button"
                  variant="brand"
                  className="min-h-11 w-full shrink-0 sm:w-auto"
                  data-testid="referral-utm-copy"
                  onClick={() => void copyText(taggedInviteLink, 'stage192_utmCopied')}
                >
                  <Copy className="mr-1 h-4 w-4" />
                  {t('stage192_utmCopyLink')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn(
            MOBILE_FLAT_CARD_CLASS,
            'sm:border-slate-800 sm:bg-slate-900 sm:text-white',
          )}
        >
          <CardHeader className={MOBILE_FLAT_CARD_HEADER_CLASS}>
            <CardTitle>{t('stage1143_howItWorks')}</CardTitle>
          </CardHeader>
          <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'space-y-6 text-sm text-slate-400')}>
            <p>{t('stage1143_howStep1')}</p>
            <p>{t('stage1143_howStep2')}</p>
            <p>{t('stage1143_howStep3')}</p>
          </CardContent>
        </Card>
      </section>

      <ReferralMarketingKit
        referralLink={formatAmbassadorShareLink(String(data?.referralLink || '').trim()) || data?.referralLink || ''}
        landingShareUrl={cleanInviteLink}
        landingShortLabel={displayLinkCaption}
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
        ambassadorBadge={data?.marketingCard?.ambassadorBadge || 'pro'}
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
        qrOpenLabel={t('stage200_qrOpen')}
        qrShareLabel={t('stage200_qrShare')}
        qrShareFailToast={t('stage200_qrShareFail')}
        qrHint={t('stage200_qrHint')}
        storiesCardHeadline={storiesCardHeadline}
        storiesTierStatusLine={storiesTierStatusLine}
        storiesAmbassadorBadgeLine={stories.ambassadorBadgeLine || ''}
        storiesTeamHeadline={stories.teamHeadline || ''}
        storiesTeamAmountLine={stories.teamAmountLine || ''}
        storiesTeamCtaLine={stories.teamCtaLine || ''}
      />

      <Card className={MOBILE_FLAT_CARD_CLASS}>
        <CardContent
          className={cn(
            MOBILE_FLAT_CARD_CONTENT_CLASS,
            'flex items-center gap-2 text-sm text-slate-600 sm:p-4',
          )}
        >
          <ArrowRight className="h-4 w-4 text-brand" />
          <span>
            {t('stage1143_walletHint')}{' '}
            <button
              type="button"
              className="inline-flex min-h-11 items-center font-medium text-brand underline"
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
