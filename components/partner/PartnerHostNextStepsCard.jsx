'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Calendar, ChevronRight, Copy, Gift, Inbox, MessageCircle, Share2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getUIText } from '@/lib/translations'
import { getPublicSiteUrl } from '@/lib/site-url'
import { formatPrice } from '@/lib/currency'
import { usePartnerOnboardingStatus } from '@/lib/hooks/use-partner-onboarding-status'

function excerptDescription(text, max = 120) {
  const s = String(text || '').replace(/\s+/g, ' ').trim()
  if (!s) return ''
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`
}

/**
 * Stage 143.1 / 149.1 — «Что делать дальше» после первого объявления.
 * Stage 187.0 — variant `compact`: collapsed chip on dashboard.
 * @param {{ language?: string, partnerId?: string | null, variant?: 'full' | 'compact' }} props
 */
export function PartnerHostNextStepsCard({ language = 'ru', partnerId = null, variant = 'full' }) {
  const t = useMemo(() => (key, ctx) => getUIText(key, language, ctx), [language])
  const { data: onboarding, isLoading: loading } = usePartnerOnboardingStatus()
  const [dismissed, setDismissed] = useState(false)
  const [expanded, setExpanded] = useState(variant !== 'compact')

  const hasListing = Boolean(onboarding?.hasListing)
  const latestListingId = onboarding?.latestListingId || null
  const latestListingStatus = onboarding?.latestListingStatus || null
  const latestTitle = onboarding?.latestListingTitle || ''
  const latestDescription = onboarding?.latestListingDescription || ''
  const latestPriceThb =
    onboarding?.latestListingBasePriceThb != null
      ? Number(onboarding.latestListingBasePriceThb)
      : null
  const latestCurrency = onboarding?.latestListingBaseCurrency || 'THB'

  const storageKey = partnerId ? `partner_next_steps_dismissed_${partnerId}` : null

  useEffect(() => {
    if (!storageKey) return
    try {
      if (localStorage.getItem(storageKey) === '1') setDismissed(true)
    } catch {
      /* ignore */
    }
  }, [storageKey])

  const publicListingUrl = useMemo(() => {
    if (!latestListingId) return ''
    const base = (getPublicSiteUrl() || '').replace(/\/$/, '')
    return `${base}/listings/${latestListingId}`
  }, [latestListingId])

  const sharePitch = useMemo(() => {
    if (!publicListingUrl) return ''
    const priceLine =
      latestPriceThb != null && Number.isFinite(latestPriceThb) && latestPriceThb > 0
        ? formatPrice(latestPriceThb, latestCurrency || 'THB')
        : '—'
    const excerpt = excerptDescription(latestDescription) || '—'
    return t('partnerPostListing_sharePitch')
      .replace(/\{\{title\}\}/g, latestTitle || '—')
      .replace(/\{\{price\}\}/g, priceLine)
      .replace(/\{\{excerpt\}\}/g, excerpt)
      .replace(/\{\{url\}\}/g, publicListingUrl)
  }, [latestCurrency, latestDescription, latestPriceThb, latestTitle, publicListingUrl, t])

  const steps = useMemo(
    () => [
      {
        id: 'share',
        icon: Share2,
        title: t('partnerPostListing_shareTitle'),
        hint: t('partnerPostListing_shareHint'),
        href: '/partner/listings',
        isShare: true,
      },
      {
        id: 'calendar',
        icon: Calendar,
        title: t('partnerPostListing_calendarTitle'),
        hint: t('partnerPostListing_calendarHint'),
        href: '/partner/calendar',
      },
      {
        id: 'referral',
        icon: Gift,
        title: t('partnerPostListing_referralTitle'),
        hint: t('partnerPostListing_referralHint'),
        href: '/profile/referral',
      },
      {
        id: 'bookings',
        icon: Inbox,
        title: t('partnerPostListing_bookingsTitle'),
        hint: t('partnerPostListing_bookingsHint'),
        href: '/partner/bookings',
      },
    ],
    [t],
  )

  async function copyPublicLink() {
    if (!publicListingUrl) return
    try {
      await navigator.clipboard.writeText(publicListingUrl)
      toast.success(t('partnerPostListing_linkCopied'))
    } catch {
      toast.error(t('partnerPostListing_linkCopyFailed'))
    }
  }

  function openTelegramShare() {
    if (!publicListingUrl) return
    const text = encodeURIComponent(sharePitch || latestTitle || publicListingUrl)
    const url = encodeURIComponent(publicListingUrl)
    window.open(
      `https://t.me/share/url?url=${url}&text=${text}`,
      '_blank',
      'noopener,noreferrer',
    )
  }

  function openWhatsAppShare() {
    if (!publicListingUrl) return
    const text = encodeURIComponent(sharePitch || `${latestTitle} ${publicListingUrl}`.trim())
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer')
  }

  function dismiss() {
    setDismissed(true)
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, '1')
      } catch {
        /* ignore */
      }
    }
  }

  const showModerationBanner = String(latestListingStatus || '').toUpperCase() === 'PENDING'

  if (loading || !hasListing || dismissed) return null

  if (variant === 'compact' && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-full min-h-[44px] items-center justify-between gap-2 rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-left text-sm font-medium text-slate-900 transition-colors hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        data-testid="partner-host-next-steps-compact"
      >
        <span className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 shrink-0 text-brand" aria-hidden />
          <span className="truncate">
            {t('partnerPostListing_compactChip', 'Что делать дальше')}
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-brand" aria-hidden />
      </button>
    )
  }

  return (
    <Card
      className="border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 via-white to-brand/5 shadow-sm"
      data-testid="partner-host-next-steps"
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-brand" aria-hidden />
              {t('partnerPostListing_title')}
            </CardTitle>
            <CardDescription>{t('partnerPostListing_subtitle')}</CardDescription>
          </div>
          {variant === 'compact' ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 min-h-[44px] min-w-[44px] px-2"
              onClick={() => setExpanded(false)}
              aria-label={t('partnerOnboarding_collapse', 'Свернуть')}
            >
              {t('partnerOnboarding_collapse', 'Свернуть')}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {showModerationBanner ? (
          <div
            className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950"
            data-testid="partner-host-next-steps-moderation"
          >
            <span className="font-semibold">{t('partnerEdit_statusPending')}</span>
            <span className="text-amber-900/90"> · {t('partnerPostListing_moderationEta')}</span>
          </div>
        ) : null}

        {steps.map((step) => {
          const Icon = step.icon
          if (step.isShare && publicListingUrl) {
            return (
              <div
                key={step.id}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-3 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                    <Icon className="h-4 w-4" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">{step.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{step.hint}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={publicListingUrl}
                    className="h-9 text-xs font-mono text-slate-700"
                    aria-label={t('partnerPostListing_shareTitle')}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => void copyPublicLink()}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={openTelegramShare}>
                    <MessageCircle className="h-4 w-4 mr-1.5" />
                    Telegram
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={openWhatsAppShare}>
                    WhatsApp
                  </Button>
                </div>
              </div>
            )
          }

          return (
            <div
              key={step.id}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Icon className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">{step.title}</p>
                <p className="text-xs text-slate-500">{step.hint}</p>
              </div>
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <Link href={step.href}>
                  {t('partnerOnboarding_go')}
                  <ChevronRight className="h-4 w-4 ml-0.5" />
                </Link>
              </Button>
            </div>
          )
        })}
        <Button variant="ghost" size="sm" className="text-slate-500" onClick={dismiss}>
          {t('partnerPostListing_dismiss')}
        </Button>
      </CardContent>
    </Card>
  )
}
