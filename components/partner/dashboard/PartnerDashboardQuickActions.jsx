'use client'

import Link from 'next/link'
import { Plus, Lock, Tag, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'

const SCROLL_ROW_CLASS =
  'flex w-full gap-2 overflow-x-auto pb-0.5 scrollbar-thin snap-x snap-proximity [-webkit-overflow-scrolling:touch]'

const PILL_CLASS =
  'shrink-0 snap-start min-h-[44px] rounded-full px-4 gap-1.5'

/**
 * Compact horizontal quick actions for partner dashboard header (Stage 187.0).
 */
export function PartnerDashboardQuickActions({ language = 'ru', onRefresh }) {
  const t = (key) => getUIText(key, language)

  return (
    <div className={cn(SCROLL_ROW_CLASS)} role="toolbar" aria-label={t('partnerDashboard_quickActionsAria')}>
      <Button asChild variant="brand" size="sm" className={PILL_CLASS}>
        <Link href="/partner/listings/new">
          <Plus className="h-4 w-4" />
          {t('partnerDashboard_newListing')}
        </Link>
      </Button>
      <Button variant="outline" size="sm" asChild className={PILL_CLASS}>
        <Link href="/partner/calendar">
          <Lock className="h-4 w-4" />
          {t('partnerDashboard_blockDates')}
        </Link>
      </Button>
      <Button variant="outline" size="sm" asChild className={PILL_CLASS}>
        <Link href="/partner/promo">
          <Tag className="h-4 w-4" />
          {t('partnerNav_promo')}
        </Link>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        type="button"
        className={cn(PILL_CLASS, 'min-w-[44px] px-3')}
        onClick={() => onRefresh?.()}
        title={t('partnerDashboard_refresh')}
        aria-label={t('partnerDashboard_refresh')}
      >
        <RefreshCw className="h-4 w-4" />
      </Button>
    </div>
  )
}
