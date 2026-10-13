'use client'

/**
 * Stage 207 — Stories invite card on the referral Link tab:
 * background picker (beach / city / sea), live preview, share / save,
 * and a counter of visits + sign-ups that came from the story QR.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { toPng } from 'html-to-image'
import { Download, Loader2, Share2, Sparkles, UserPlus, Eye } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getSiteBrandSlug } from '@/lib/site-url'
import { useCurrency } from '@/contexts/currency-context'
import { useI18n } from '@/contexts/i18n-context'
import { useAmbassadorDisplayFx } from '@/lib/hooks/use-ambassador-display-fx'
import { buildReferralPitchTokens } from '@/lib/referral/referral-share-pitch-tokens'
import { isUuidLike } from '@/lib/referral/uuid-like'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
  MOBILE_FLAT_CARD_HEADER_CLASS,
} from '@/lib/ui/mobile-flat-canvas'
import { ReferralStoryInviteCard, STORY_THEMES } from '@/components/referral/ReferralStoryInviteCard'

const THEME_LABEL_KEYS = { beach: 'stage207_themeBeach', city: 'stage207_themeCity', sea: 'stage207_themeSea' }

/** `/s/{code}?bg=…` on the same origin as the clean invite link. */
function buildStoryLink(inviteLink, code, theme) {
  const c = String(code || '').trim()
  if (!c) return ''
  let origin = ''
  try {
    origin = new URL(String(inviteLink || '')).origin
  } catch {
    origin = typeof window !== 'undefined' ? window.location.origin : ''
  }
  return origin ? `${origin}/s/${encodeURIComponent(c)}?bg=${theme}` : ''
}

export function ReferralStoryInviteSection({ data, t, brand, inviteLink, linkCaption, welcomeBonusThb }) {
  const { language } = useI18n()
  const { currency } = useCurrency()
  const { exchangeRates } = useAmbassadorDisplayFx()
  const [theme, setTheme] = useState('beach')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [shareBusy, setShareBusy] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const [stats, setStats] = useState(null)
  const exportRef = useRef(null)

  const code = String(data?.code || '').trim()
  const storyLink = useMemo(() => buildStoryLink(inviteLink, code, theme), [inviteLink, code, theme])

  useEffect(() => {
    let cancelled = false
    if (!storyLink) {
      setQrDataUrl('')
      return
    }
    QRCode.toDataURL(storyLink, { width: 720, margin: 2, errorCorrectionLevel: 'M' }).then((url) => {
      if (!cancelled) setQrDataUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [storyLink])

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/v2/referral/story-stats', { credentials: 'include', cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (json?.success) setStats(json.data)
    } catch {
      /* counter is optional */
    }
  }, [])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  const giftAmount = useMemo(
    () =>
      String(
        buildReferralPitchTokens({ welcomeBonusThb, currency, rateMap: exchangeRates, language, brand, link: storyLink })
          .welcomeAmount || '',
      ).trim(),
    [welcomeBonusThb, currency, exchangeRates, language, brand, storyLink],
  )

  const rawName = String(data?.displayName || '').trim()
  const cardProps = {
    theme,
    brand,
    headline: t(giftAmount ? 'stage206_storyHeadline' : 'stage73_storiesCardHeadline').replace(/\{brand\}/g, brand),
    giftAmount,
    giftSuffix: t(giftAmount ? 'stage206_storyGiftSuffix' : 'stage206_storyGiftSuffixNoAmount'),
    categories: t('stage206_storyCategories'),
    qrDataUrl,
    code,
    codeLabel: t('stage206_storyCodeLabel'),
    linkCaption,
    scanHint: t('stage206_storyScanHint'),
    displayName: rawName && !isUuidLike(rawName) ? rawName : '',
  }

  async function buildFile() {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const dataUrl = await toPng(exportRef.current, { pixelRatio: 3, cacheBust: true, backgroundColor: '#0F172A' })
    const safeCode = (code || 'invite').replace(/[^\w-]+/g, '_').slice(0, 24)
    const fileName = `${getSiteBrandSlug()}-story-${theme}-${safeCode}.png`
    const blob = await (await fetch(dataUrl)).blob()
    return { dataUrl, fileName, file: new File([blob], fileName, { type: 'image/png' }) }
  }

  function saveDataUrl(dataUrl, fileName) {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = fileName
    a.click()
  }

  async function handleSave() {
    if (!exportRef.current || !qrDataUrl) return
    setSaveBusy(true)
    try {
      const { dataUrl, fileName } = await buildFile()
      saveDataUrl(dataUrl, fileName)
    } catch (e) {
      console.warn('[ReferralStoryInviteSection] save:', e?.message || e)
    } finally {
      setSaveBusy(false)
    }
  }

  async function handleShare() {
    if (!exportRef.current || !qrDataUrl) return
    setShareBusy(true)
    let built = null
    try {
      built = await buildFile()
      const payload = { files: [built.file], title: brand }
      if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare(payload)) {
        await navigator.share(payload)
        return
      }
      saveDataUrl(built.dataUrl, built.fileName)
      toast.message(t('stage206_storyShareFail'))
    } catch (e) {
      if (e?.name === 'AbortError') return
      if (built) saveDataUrl(built.dataUrl, built.fileName)
      toast.error(t('stage206_storyShareFail'))
    } finally {
      setShareBusy(false)
    }
  }

  const visits = Number(stats?.visits) || 0
  const signups = Number(stats?.signups) || 0
  const bestTheme = useMemo(() => {
    const bt = stats?.byTheme
    if (!bt || signups < 1) return null
    return STORY_THEMES.reduce((best, th) => ((bt[th]?.signups || 0) > (bt[best]?.signups || 0) ? th : best), STORY_THEMES[0])
  }, [stats, signups])

  const motivation =
    signups > 0
      ? t('stage207_counterMotivationHas')
      : visits > 0
        ? t('stage207_counterMotivationVisits')
        : t('stage207_counterMotivationEmpty')

  return (
    <Card className={MOBILE_FLAT_CARD_CLASS} data-testid="referral-story-section">
      {/* Off-screen full-size card used for PNG export */}
      <div className="fixed left-[-9999px] top-0" aria-hidden>
        <ReferralStoryInviteCard ref={exportRef} {...cardProps} />
      </div>

      <CardHeader className={MOBILE_FLAT_CARD_HEADER_CLASS}>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-brand" aria-hidden />
          {t('stage73_downloadStoriesCard')}
        </CardTitle>
        <CardDescription className="text-slate-600">{t('stage206_storyPreviewHint')}</CardDescription>
      </CardHeader>

      <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'space-y-4')}>
        {/* Story counter */}
        <div className="rounded-2xl border border-brand/20 bg-brand/5 p-4" data-testid="referral-story-counter">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('stage207_counterTitle')}</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-brand shadow-sm">
                <Eye className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-xl font-bold tabular-nums text-slate-900" data-testid="referral-story-visits">{visits}</p>
                <p className="text-xs text-slate-600">{t('stage207_counterVisits')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-sm">
                <UserPlus className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-xl font-bold tabular-nums text-brand" data-testid="referral-story-signups">{signups}</p>
                <p className="text-xs text-slate-600">{t('stage207_counterSignups')}</p>
              </div>
            </div>
          </div>
          <p className="mt-3 text-sm leading-snug text-slate-700" data-testid="referral-story-motivation">{motivation}</p>
          {bestTheme ? (
            <p className="mt-1 text-xs text-slate-500" data-testid="referral-story-best-theme">
              {t('stage207_counterBestTheme').replace('{theme}', t(THEME_LABEL_KEYS[bestTheme]))}
            </p>
          ) : null}
        </div>

        {/* Background picker — single horizontal row */}
        <div>
          <p className="mb-2 text-sm font-medium text-slate-800">{t('stage207_themePickerLabel')}</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label={t('stage207_themePickerLabel')}>
            {STORY_THEMES.map((th) => {
              const selected = theme === th
              return (
                <button
                  key={th}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-testid={`referral-story-theme-${th}`}
                  onClick={() => setTheme(th)}
                  className={cn(
                    'inline-flex h-11 shrink-0 items-center rounded-xl border px-4 text-sm font-medium transition-colors',
                    selected ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-brand/40',
                  )}
                >
                  {t(THEME_LABEL_KEYS[th])}
                </button>
              )
            })}
          </div>
        </div>

        {/* Preview (half scale of the 360×640 card) */}
        <div className="flex justify-center">
          <div
            className="relative h-[320px] w-[180px] overflow-hidden rounded-2xl shadow-lg ring-1 ring-black/5"
            data-testid="referral-story-preview"
          >
            <ReferralStoryInviteCard
              {...cardProps}
              style={{ transform: 'scale(0.5)', transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="brand"
            className="min-h-11 w-full flex-1"
            disabled={!qrDataUrl || shareBusy}
            onClick={() => void handleShare()}
            data-testid="referral-story-share"
          >
            {shareBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
            {t('stage206_storyShare')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full flex-1 border-brand/25 text-brand"
            disabled={!qrDataUrl || saveBusy}
            onClick={() => void handleSave()}
            data-testid="referral-story-save"
          >
            {saveBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {t('stage206_storySave')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default ReferralStoryInviteSection
