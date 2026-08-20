'use client'

/**
 * Link tab — clean invite tools (Stage 131.A5.C).
 * One QR, native share (same idea as hero), copy link; UTM collapsed under Advanced.
 */

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowRight, ChevronDown, Copy, Share2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AMBASSADOR_UTM_CHANNELS,
  buildAmbassadorUtmLink,
  formatAmbassadorLinkCaption,
  formatAmbassadorShareLink,
} from '@/lib/referral/ambassador-utm-link'
import { getSiteDisplayName } from '@/lib/site-url'
import { cn } from '@/lib/utils'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
  MOBILE_FLAT_CARD_HEADER_CLASS,
} from '@/lib/ui/mobile-flat-canvas'
import { toast } from 'sonner'

const CHANNEL_LABEL_KEYS = {
  telegram: 'stage192_utmChannelTelegram',
  instagram: 'stage192_utmChannelInstagram',
  youtube: 'stage192_utmChannelYoutube',
  vk: 'stage192_utmChannelVk',
}

export function ReferralProfileTabLink({ data, t, welcomeBonusThb: _welcomeBonusThb }) {
  const router = useRouter()
  const [utmChannel, setUtmChannel] = useState('telegram')
  const [utmOpen, setUtmOpen] = useState(false)
  const [shareBusy, setShareBusy] = useState(false)

  const brand = String(data?.brandName || '').trim() || getSiteDisplayName()
  const welcomeCode = String(data?.code || '').trim() || 'AIR-XXXXXX'
  const campaignId =
    String(data?.code || data?.userId || data?.id || 'ambassador')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 64) || 'ambassador'

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

  const copyText = useCallback(
    async (value, successKey = 'referralStage726_linkCopied') => {
      const v = String(value || '').trim()
      if (!v) return
      try {
        await navigator.clipboard.writeText(v)
        toast.success(t(successKey))
      } catch {
        toast.error(t('referralStage726_copyFail'))
      }
    },
    [t],
  )

  const handleShare = useCallback(async () => {
    const url = String(cleanInviteLink || '').trim()
    if (!url || shareBusy) return
    setShareBusy(true)
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        try {
          await navigator.share({
            title: t('stage131a5_heroShareCta'),
            text: String(t('stage73_shareBodyDefault') || '')
              .replace(/\{brand\}/g, brand)
              .replace(/\{link\}/g, url),
            url,
          })
          return
        } catch (err) {
          if (err?.name === 'AbortError') return
        }
      }
      await copyText(url)
    } finally {
      setShareBusy(false)
    }
  }, [cleanInviteLink, shareBusy, t, brand, copyText])

  return (
    <div className="space-y-6" data-testid="referral-link-tab-v2">
      <Card className={MOBILE_FLAT_CARD_CLASS}>
        <CardHeader className={MOBILE_FLAT_CARD_HEADER_CLASS}>
          <CardTitle>{t('stage1143_qrCardTitle')}</CardTitle>
          <CardDescription className="text-slate-600">{t('stage131a5_linkSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'space-y-5')}>
          <div className="mx-auto w-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {cleanInviteLink ? (
              <QRCodeSVG
                value={cleanInviteLink}
                size={180}
                level="M"
                includeMargin
                data-testid="referral-link-qr"
              />
            ) : (
              <div className="h-[180px] w-[180px] rounded bg-slate-100" />
            )}
          </div>

          {displayLinkCaption ? (
            <p
              className="break-all text-center text-sm font-medium text-slate-700"
              data-testid="referral-qr-caption"
            >
              {displayLinkCaption}
            </p>
          ) : null}

          <div className="space-y-2">
            <p className="text-xs text-slate-500">{t('stage1143_yourCode')}</p>
            <div className="flex gap-2">
              <Input
                value={welcomeCode}
                readOnly
                className="font-semibold tracking-wide"
                data-testid="referral-personal-code"
              />
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] min-w-[44px] shrink-0"
                aria-label={t('referralStage726_copy')}
                onClick={() => void copyText(welcomeCode)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="brand"
              className="min-h-[44px] w-full flex-1"
              data-testid="referral-link-share"
              disabled={!cleanInviteLink || shareBusy}
              onClick={() => void handleShare()}
            >
              <Share2 className="mr-2 h-4 w-4" />
              {t('stage131a5_heroShareCta')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] w-full flex-1"
              data-testid="referral-clean-copy"
              disabled={!cleanInviteLink}
              onClick={() => void copyText(cleanInviteLink)}
            >
              <Copy className="mr-2 h-4 w-4" />
              {t('stage200_copyCleanLink')}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2" data-testid="referral-link-messengers">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              disabled={!cleanInviteLink}
              onClick={() => {
                const url = String(cleanInviteLink || '').trim()
                if (!url) return
                const text = String(t('stage73_shareBodyDefault') || '')
                  .replace(/\{brand\}/g, brand)
                  .replace(/\{link\}/g, url)
                window.open(
                  `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
                  '_blank',
                  'noopener,noreferrer',
                )
              }}
            >
              {t('stage131a5_shareViaTelegram')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              disabled={!cleanInviteLink}
              onClick={() => {
                const url = String(cleanInviteLink || '').trim()
                if (!url) return
                const text = String(t('stage73_shareBodyDefault') || '')
                  .replace(/\{brand\}/g, brand)
                  .replace(/\{link\}/g, url)
                window.open(
                  `https://wa.me/?text=${encodeURIComponent(text)}`,
                  '_blank',
                  'noopener,noreferrer',
                )
              }}
            >
              {t('stage131a5_shareViaWhatsapp')}
            </Button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3 space-y-2 text-sm text-slate-600">
            <p className="font-medium text-slate-800">{t('stage1143_howItWorks')}</p>
            <ol className="list-decimal space-y-1 pl-4 text-xs leading-relaxed">
              <li>{t('stage1143_howStep1')}</li>
              <li>{t('stage1143_howStep2')}</li>
              <li>{t('stage1143_howStep3')}</li>
            </ol>
          </div>

          <div className="border-t border-slate-200 pt-3">
            <button
              type="button"
              className="flex min-h-[44px] w-full items-center justify-between gap-2 text-left text-sm font-medium text-slate-800"
              data-testid="referral-utm-toggle"
              aria-expanded={utmOpen}
              onClick={() => setUtmOpen((v) => !v)}
            >
              <span>{t('stage131a5_linkAdvancedTitle')}</span>
              <ChevronDown
                className={cn('h-4 w-4 shrink-0 text-slate-500 transition', utmOpen && 'rotate-180')}
              />
            </button>

            {utmOpen ? (
              <div className="mt-3 space-y-3" data-testid="referral-utm-builder">
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
                          'inline-flex min-h-11 items-center rounded-xl border px-3.5 text-sm font-medium transition',
                          selected
                            ? 'border-brand bg-brand text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-brand/40',
                        )}
                      >
                        {t(CHANNEL_LABEL_KEYS[ch])}
                      </button>
                    )
                  })}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px] w-full"
                  data-testid="referral-utm-copy"
                  onClick={() => void copyText(taggedInviteLink, 'stage192_utmCopied')}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  {t('stage192_utmCopyLink')}
                </Button>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

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

export default ReferralProfileTabLink
