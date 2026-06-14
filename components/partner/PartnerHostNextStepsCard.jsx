'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Calendar, ChevronRight, Gift, Inbox, Share2, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'

/**
 * Stage 143.1 — «Что делать дальше» после первого объявления.
 * @param {{ language?: string, partnerId?: string | null }} props
 */
export function PartnerHostNextStepsCard({ language = 'ru', partnerId = null }) {
  const t = useMemo(() => (key, ctx) => getUIText(key, language, ctx), [language])
  const [loading, setLoading] = useState(true)
  const [hasListing, setHasListing] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const storageKey = partnerId ? `partner_next_steps_dismissed_${partnerId}` : null

  useEffect(() => {
    if (!storageKey) return
    try {
      if (localStorage.getItem(storageKey) === '1') setDismissed(true)
    } catch {
      /* ignore */
    }
  }, [storageKey])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/v2/partner/onboarding-status', {
          credentials: 'include',
          cache: 'no-store',
        })
        const json = await res.json().catch(() => ({}))
        if (!cancelled && json?.success && json.data) {
          setHasListing(Boolean(json.data.hasListing))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const steps = useMemo(
    () => [
      {
        id: 'share',
        icon: Share2,
        title: t('partnerPostListing_shareTitle'),
        hint: t('partnerPostListing_shareHint'),
        href: '/partner/listings',
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

  if (loading || !hasListing || dismissed) return null

  return (
    <Card
      className="border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 via-white to-brand/5 shadow-sm"
      data-testid="partner-host-next-steps"
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-brand" aria-hidden />
          {t('partnerPostListing_title')}
        </CardTitle>
        <CardDescription>{t('partnerPostListing_subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {steps.map((step) => {
          const Icon = step.icon
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
