'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Circle, ChevronRight, ClipboardList } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'
import { usePartnerOnboardingStatus } from '@/lib/hooks/use-partner-onboarding-status'
import { cn } from '@/lib/utils'
import {
  MOBILE_FLAT_BRAND_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
  MOBILE_FLAT_CARD_HEADER_CLASS,
} from '@/lib/ui/mobile-flat-canvas'

/**
 * Stage 116.2 — чек-лист после approve партнёра (SSOT API).
 * Stage 187.0 — variant `compact`: collapsed chip, expand on tap.
 * @param {{ language?: string, variant?: 'full' | 'compact' }} props
 */
export function PartnerOnboardingChecklist({ language = 'ru', variant = 'full' }) {
  const t = (key, fb) => getUIText(key, language) || fb
  const { data: statusData, isLoading: loading } = usePartnerOnboardingStatus()
  const [expanded, setExpanded] = useState(variant !== 'compact')
  const status = statusData ?? {
    payoutReady: false,
    calendarConfigured: false,
    hasListing: false,
    listingCount: 0,
    latestListingId: null,
  }

  const steps = useMemo(() => {
    const payout = {
      id: 'payout',
      done: status.payoutReady,
      title: t('partnerOnboarding_payoutTitle', 'Заполните профиль выплат'),
      hint: t('partnerOnboarding_payoutHint', 'Банковский счёт или USDT-кошелёк для выплат'),
      href: '/partner/payout-profiles',
    }
    const calendarHref = status.latestListingId
      ? `/partner/listings/${status.latestListingId}?highlight=calendar`
      : '/partner/calendar'
    const calendar = {
      id: 'calendar',
      done: status.calendarConfigured,
      title: t('partnerOnboarding_calendarTitle', 'Подключите календарь'),
      hint: t(
        'partnerOnboarding_calendarHint',
        'iCal-синхронизация или отметьте занятые даты вручную',
      ),
      href: calendarHref,
    }
    const listing = {
      id: 'listing',
      done: status.hasListing,
      title: t('partnerOnboarding_listingTitle', 'Создайте объявление'),
      hint: t('partnerOnboarding_listingHint', 'Хотя бы одно объявление в кабинете'),
      href: '/partner/listings/new',
    }
    // First-run: listing → payout profile → iCal (Stage 194.0-C)
    if (status.listingCount === 0) {
      return [listing, payout, calendar]
    }
    return [payout, calendar, listing]
  }, [status, language])

  const subtitleKey =
    status.listingCount === 0 ? 'partnerOnboarding_subtitleListingFirst' : 'partnerOnboarding_subtitle'

  const completed = steps.filter((s) => s.done).length
  if (!loading && completed >= steps.length) return null

  if (variant === 'compact' && !expanded && !loading) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-full min-h-[44px] items-center justify-between gap-2 rounded-2xl border border-brand/25 bg-brand/5 px-4 py-3 text-left text-sm font-medium text-slate-900 transition-colors hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        data-testid="partner-onboarding-checklist-compact"
      >
        <span className="flex items-center gap-2 min-w-0">
          <ClipboardList className="h-4 w-4 shrink-0 text-brand" aria-hidden />
          <span className="truncate">
            {t('partnerOnboarding_compactChip', 'Пройдено {done} из {total} шагов')
              .replace('{done}', String(completed))
              .replace('{total}', String(steps.length))}
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-brand" aria-hidden />
      </button>
    )
  }

  return (
    <Card
      className={cn(MOBILE_FLAT_BRAND_CARD_CLASS, 'sm:bg-brand/5')}
      data-testid="partner-onboarding-checklist"
    >
      <CardHeader className={cn(MOBILE_FLAT_CARD_HEADER_CLASS, 'sm:pb-2')}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-brand" aria-hidden />
              {t('partnerOnboarding_title', 'Старт как партнёр')}
            </CardTitle>
            <CardDescription>
              {t(subtitleKey, 'Payout profile → календарь → первое объявление')} — {completed}/{steps.length}
            </CardDescription>
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
      <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'space-y-2')}>
        {loading ? (
          <p className="text-sm text-slate-500">{t('loading', 'Загрузка…')}</p>
        ) : (
          steps.map((step) => (
            <div
              key={step.id}
              className={cn(
                'flex items-center gap-3 max-sm:border-b max-sm:border-slate-100 max-sm:py-2.5',
                'sm:rounded-2xl sm:border sm:border-slate-200 sm:bg-white sm:px-3 sm:py-2.5',
              )}
            >
              {step.done ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-slate-300" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">{step.title}</p>
                <p className="text-xs text-slate-500">{step.hint}</p>
              </div>
              {!step.done ? (
                <Button asChild variant="brand" size="sm" className="min-h-11 shrink-0">
                  <Link href={step.href}>
                    {t('partnerOnboarding_go', 'Перейти')}
                    <ChevronRight className="h-4 w-4 ml-0.5" />
                  </Link>
                </Button>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
