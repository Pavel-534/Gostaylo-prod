'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import QRCode from 'qrcode'
import { toPng } from 'html-to-image'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, Facebook, FileText, Loader2, Lock, MessageCircle, Share2, Smartphone } from 'lucide-react'
import { downloadAmbassadorCardPdf } from '@/lib/referral/ambassador-card-pdf'
import { isUuidLike } from '@/lib/referral/uuid-like'
import { getSiteDisplayName } from '@/lib/site-url'
import { STORIES_TEAM_MIN_DIRECT_PARTNERS } from '@/lib/referral/referral-badges'

/**
 * QR + PDF-визитка + PNG + Stories 9:16 (два шаблона) + шаринг.
 */
export function ReferralMarketingKit({
  referralLink = '',
  /** Полный URL визитки `/u/[id]` — QR/PDF/Stories (при наличии). Иначе `referralLink`. */
  landingShareUrl = '',
  /** Подпись без схемы, например example.com/u/uuid — под QR/PDF */
  landingShortLabel = '',
  shareBody = '',
  shareMessage = '',
  code = '',
  brandName = 'Platform',
  displayName = '',
  ambassadorBadge = 'silver',
  pdfButtonLabel = 'PDF',
  pdfCtaLine = '',
  marketingTitle,
  marketingSubtitle,
  downloadLabel,
  storiesDownloadLabel = 'Stories',
  /** Фиксированный текст на PNG Stories (бренд). */
  storiesCardHeadline = '',
  /** Динамическая строка статуса (Stage 74.1): «Мой уровень в {brand}: …». */
  storiesTierStatusLine = '',
  /** Stage 74.2 — бейдж на первой карточке Stories (из referralStoriesCopy). */
  storiesAmbassadorBadgeLine = '',
  /** Stage 74.2 — второй шаблон «доход команды». */
  storiesTeamHeadline = '',
  storiesTeamAmountLine = '',
  storiesTeamCtaLine = '',
  storiesTeamDownloadLabel = 'Stories · team',
  shareFbLabel,
  shareTgLabel,
  shareWaLabel,
  badgeGoldLabel = 'Gold Ambassador',
  badgeSilverLabel = 'Silver Ambassador',
  pdfOfficialStatusLine = '',
  /** Подзаголовок бренда под логотипом PDF — из i18n с `{brand}`. */
  pdfBrandSubtitle = '',
  /** Stage 75.1 — Top 10 Monthly: золотая рамка и Elite Partner в PDF. */
  pdfElitePartner = false,
  pdfElitePartnerLine = '',
  /** SSOT: `stats.directPartnersInvited` — активированные партнёры (как tier); порог — `STORIES_TEAM_MIN_DIRECT_PARTNERS`. */
  directPartnersInvitedCount = 0,
  storiesTeamLockedHint = '',
}) {
  const link = String(referralLink || '').trim()
  const landing = String(landingShareUrl || '').trim()
  /** Основная ссылка для QR, PNG, TG/FB: короткая визитка, иначе длинный ref. */
  const qrLink = landing || link
  const linkCaption = String(landingShortLabel || '').trim() || qrLink

  const brandChip = useMemo(() => {
    const b = String(brandName || '').trim()
    return b || getSiteDisplayName()
  }, [brandName])

  const storiesHeadlineResolved = useMemo(() => {
    const raw = String(storiesCardHeadline || '').trim()
    if (raw) return raw.replace(/\{brand\}/g, getSiteDisplayName())
    const site = getSiteDisplayName()
    return site ? `Travel and earn with ${site}` : 'Travel and earn'
  }, [storiesCardHeadline])

  const [downloading, setDownloading] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [storiesBusy, setStoriesBusy] = useState(false)
  const [storiesTeamBusy, setStoriesTeamBusy] = useState(false)
  const [storyQrDataUrl, setStoryQrDataUrl] = useState('')
  const storiesCardRef = useRef(null)
  const storiesTeamCardRef = useRef(null)

  const safeDisplayName = useMemo(() => {
    const d = String(displayName || '').trim()
    if (!d || isUuidLike(d)) return 'Ambassador'
    return d
  }, [displayName])

  const badgeLine = String(ambassadorBadge).toLowerCase() === 'gold' ? badgeGoldLabel : badgeSilverLabel

  const partnerActivations = Number(directPartnersInvitedCount) || 0
  const teamStoriesLocked = partnerActivations < STORIES_TEAM_MIN_DIRECT_PARTNERS
  const partnersNeededForTeamStories = Math.max(0, STORIES_TEAM_MIN_DIRECT_PARTNERS - partnerActivations)

  const defaultPitch = useMemo(() => {
    const fromI18n = String(shareBody || '').trim()
    if (fromI18n) return fromI18n
    const legacy = String(shareMessage || '').trim()
    if (legacy) return legacy
    const b = String(brandName || '').trim() || getSiteDisplayName()
    return `Travel and earn with ${b}! Your bonus link: ${qrLink}`.trim()
  }, [shareBody, shareMessage, brandName, qrLink])

  useEffect(() => {
    let cancelled = false
    if (!qrLink) {
      setStoryQrDataUrl('')
      return
    }
    QRCode.toDataURL(qrLink, {
      width: 720,
      margin: 2,
      errorCorrectionLevel: 'M',
    }).then((url) => {
      if (!cancelled) setStoryQrDataUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [qrLink])

  async function handleDownloadPng() {
    if (!qrLink || typeof window === 'undefined') return
    setDownloading(true)
    try {
      const dataUrl = await QRCode.toDataURL(qrLink, {
        width: 640,
        margin: 2,
        errorCorrectionLevel: 'M',
      })
      const safeCode = String(code || 'invite').replace(/[^\w-]+/g, '_').slice(0, 32)
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `gostaylo-invite-${safeCode}.png`
      a.click()
    } finally {
      setDownloading(false)
    }
  }

  async function handleDownloadPdf() {
    if (!qrLink || typeof window === 'undefined') return
    setPdfBusy(true)
    try {
      const safeBrand = String(brandName || 'platform')
        .replace(/[^\w\-]+/gi, '-')
        .slice(0, 24)
      await downloadAmbassadorCardPdf({
        brandName: String(brandName || 'Platform').trim() || 'Platform',
        displayName: safeDisplayName,
        ambassadorBadgeLabel: badgeLine,
        referralLink: link,
        landingShareUrl: landing || undefined,
        landingShortLabel: landing ? String(landingShortLabel || '').trim() || undefined : undefined,
        ctaLine: pdfCtaLine || undefined,
        fileBaseName: `${safeBrand}-ambassador-card`,
        officialStatusLine: pdfOfficialStatusLine || undefined,
        brandSubtitle: pdfBrandSubtitle || undefined,
        pdfVariant: pdfElitePartner ? 'elite' : 'standard',
        elitePartnerLine: pdfElitePartner ? String(pdfElitePartnerLine || '').trim() || undefined : undefined,
      })
    } finally {
      setPdfBusy(false)
    }
  }

  async function handleDownloadStoriesAmbassador() {
    if (!qrLink || !storiesCardRef.current || typeof window === 'undefined') return
    setStoriesBusy(true)
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const dataUrl = await toPng(storiesCardRef.current, {
        pixelRatio: 3,
        cacheBust: true,
        backgroundColor: '#f8fafc',
      })
      const safeCode = String(code || 'invite').replace(/[^\w-]+/g, '_').slice(0, 24)
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `gostaylo-stories-ambassador-${safeCode}.png`
      a.click()
    } catch (e) {
      console.warn('[ReferralMarketingKit] stories ambassador export:', e?.message || e)
    } finally {
      setStoriesBusy(false)
    }
  }

  async function handleDownloadStoriesTeam() {
    if (!qrLink || !storiesTeamCardRef.current || typeof window === 'undefined') return
    setStoriesTeamBusy(true)
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const dataUrl = await toPng(storiesTeamCardRef.current, {
        pixelRatio: 3,
        cacheBust: true,
        backgroundColor: '#f0f9ff',
      })
      const safeCode = String(code || 'invite').replace(/[^\w-]+/g, '_').slice(0, 24)
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `gostaylo-stories-team-${safeCode}.png`
      a.click()
    } catch (e) {
      console.warn('[ReferralMarketingKit] stories team export:', e?.message || e)
    } finally {
      setStoriesTeamBusy(false)
    }
  }

  function openWa() {
    const text = encodeURIComponent(defaultPitch)
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer')
  }

  function openTg() {
    const text = encodeURIComponent(defaultPitch)
    const url = encodeURIComponent(qrLink)
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank', 'noopener,noreferrer')
  }

  function openFb() {
    const u = encodeURIComponent(qrLink)
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${u}`, '_blank', 'noopener,noreferrer')
  }

  const badgeChip = String(storiesAmbassadorBadgeLine || '').trim()

  return (
    <>
      {/* Off-screen 9:16 — амбассадор */}
      <div
        ref={storiesCardRef}
        className="fixed left-[-9999px] top-0 z-0 flex h-[640px] w-[360px] flex-col overflow-hidden rounded-none bg-gradient-to-b from-sky-50 via-white to-teal-50 text-slate-900 shadow-none"
        aria-hidden
      >
        <div className="pointer-events-none flex flex-1 flex-col px-6 pt-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-lg font-bold text-white shadow-sm">
            A
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">{brandChip}</p>
          <p className="mt-6 px-1 text-[17px] font-semibold leading-snug text-slate-800">{storiesHeadlineResolved}</p>
          {badgeChip ? (
            <p className="mt-2 px-2 text-[13px] font-semibold leading-snug text-amber-800">{badgeChip}</p>
          ) : null}
          {String(storiesTierStatusLine || '').trim() ? (
            <p className="mt-3 px-2 text-[13px] font-medium leading-snug text-slate-700">
              {String(storiesTierStatusLine).trim()}
            </p>
          ) : null}
          <p className="mt-5 truncate px-2 text-xl font-bold text-slate-900">{safeDisplayName}</p>
          <p className="mt-2 text-sm font-medium text-teal-700">{badgeLine}</p>
          <div className="mt-auto flex flex-1 flex-col items-center justify-center pb-10 pt-4">
            {storyQrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={storyQrDataUrl}
                alt=""
                width={260}
                height={260}
                className="h-[260px] w-[260px] rounded-xl border border-slate-200 bg-white p-2 shadow-md"
              />
            ) : (
              <div className="h-[260px] w-[260px] rounded-xl bg-white/80" />
            )}
            <p className="mt-6 max-w-[280px] text-center text-[11px] leading-relaxed text-slate-500">{linkCaption}</p>
          </div>
        </div>
      </div>

      {/* Off-screen 9:16 — доход команды */}
      <div
        ref={storiesTeamCardRef}
        className="fixed left-[-9999px] top-0 z-0 flex h-[640px] w-[360px] flex-col overflow-hidden rounded-none bg-gradient-to-b from-indigo-50 via-white to-sky-50 text-slate-900 shadow-none"
        aria-hidden
      >
        <div className="pointer-events-none flex flex-1 flex-col px-6 pt-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700">{brandChip}</p>
          <p className="mt-6 px-1 text-[18px] font-bold leading-snug text-slate-900">{storiesTeamHeadline}</p>
          <p className="mt-8 text-4xl font-black tabular-nums text-indigo-800">{storiesTeamAmountLine}</p>
          <p className="mt-6 px-2 text-[15px] font-medium leading-snug text-slate-700">{storiesTeamCtaLine}</p>
          <div className="mt-auto flex flex-1 flex-col items-center justify-center pb-10 pt-6">
            {storyQrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={storyQrDataUrl}
                alt=""
                width={240}
                height={240}
                className="h-[240px] w-[240px] rounded-xl border border-slate-200 bg-white p-2 shadow-md"
              />
            ) : (
              <div className="h-[240px] w-[240px] rounded-xl bg-white/80" />
            )}
            <p className="mt-5 max-w-[280px] text-center text-[11px] leading-relaxed text-slate-500">{linkCaption}</p>
          </div>
        </div>
      </div>

      <Card className="border border-teal-200 bg-white overflow-hidden">
        <CardHeader className="pb-2 text-center sm:text-left px-4 pt-5">
          <CardTitle className="text-base flex items-center justify-center sm:justify-start gap-2">
            <Share2 className="h-4 w-4 text-teal-600 shrink-0" />
            {marketingTitle}
          </CardTitle>
          <CardDescription className="text-xs">{marketingSubtitle}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 px-4 pb-6">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:justify-center sm:gap-8">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm mx-auto sm:mx-0">
              {qrLink ? (
                <QRCodeSVG value={qrLink} size={180} level="M" includeMargin className="max-w-[min(180px,72vw)] h-auto" />
              ) : (
                <div className="w-[min(180px,72vw)] aspect-square max-w-[180px] bg-slate-100 rounded-md" />
              )}
            </div>
            <div className="flex flex-col items-stretch gap-2 w-full max-w-sm mx-auto sm:mx-0 sm:w-auto min-w-0">
              <div className="flex flex-col sm:flex-row gap-2 w-full">
                <Button
                  type="button"
                  className="w-full flex-1 bg-teal-600 hover:bg-teal-700"
                  disabled={!qrLink || downloading}
                  onClick={() => void handleDownloadPng()}
                >
                  {downloading ? <Loader2 className="h-4 w-4 mr-2 shrink-0 animate-spin" /> : <Download className="h-4 w-4 mr-2 shrink-0" />}
                  {downloadLabel}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full flex-1 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900"
                  disabled={!qrLink || pdfBusy}
                  onClick={() => void handleDownloadPdf()}
                >
                  {pdfBusy ? <Loader2 className="h-4 w-4 mr-2 shrink-0 animate-spin" /> : <FileText className="h-4 w-4 mr-2 shrink-0" />}
                  {pdfButtonLabel}
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full border-teal-200 bg-teal-50/80 hover:bg-teal-50 text-teal-900"
                disabled={!qrLink || storiesBusy || !storyQrDataUrl}
                onClick={() => void handleDownloadStoriesAmbassador()}
              >
                {storiesBusy ? <Loader2 className="h-4 w-4 mr-2 shrink-0 animate-spin" /> : <Smartphone className="h-4 w-4 mr-2 shrink-0" />}
                {storiesDownloadLabel}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full border-indigo-200 bg-indigo-50/80 hover:bg-indigo-50 text-indigo-950 disabled:opacity-70"
                disabled={teamStoriesLocked || !qrLink || storiesTeamBusy || !storyQrDataUrl}
                onClick={() => {
                  if (teamStoriesLocked) return
                  void handleDownloadStoriesTeam()
                }}
              >
                {storiesTeamBusy ? (
                  <Loader2 className="h-4 w-4 mr-2 shrink-0 animate-spin" />
                ) : teamStoriesLocked ? (
                  <Lock className="h-4 w-4 mr-2 shrink-0" />
                ) : (
                  <Smartphone className="h-4 w-4 mr-2 shrink-0" />
                )}
                {storiesTeamDownloadLabel}
              </Button>
              {teamStoriesLocked && String(storiesTeamLockedHint || '').trim() ? (
                <p className="text-[11px] leading-snug text-muted-foreground flex items-start gap-1.5">
                  <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-80" aria-hidden />
                  <span>
                    {String(storiesTeamLockedHint || '')
                      .trim()
                      .replace('{n}', String(partnersNeededForTeamStories))}
                  </span>
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start w-full pt-1">
                <Button type="button" variant="outline" className="min-w-[132px] flex-1 justify-center sm:flex-initial" onClick={openWa}>
                  <Share2 className="h-4 w-4 mr-1 shrink-0" />
                  {shareWaLabel}
                </Button>
                <Button type="button" variant="outline" className="min-w-[132px] flex-1 justify-center sm:flex-initial" onClick={openTg}>
                  <MessageCircle className="h-4 w-4 mr-1 shrink-0" />
                  {shareTgLabel}
                </Button>
                <Button type="button" variant="outline" className="min-w-[132px] flex-1 justify-center sm:flex-initial" onClick={openFb}>
                  <Facebook className="h-4 w-4 mr-1 shrink-0" />
                  {shareFbLabel}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
