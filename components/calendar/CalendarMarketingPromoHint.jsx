'use client'

/**
 * Partner calendar — marketing promo hint (trust-oriented, Stage 200.5 / 200.40).
 * Agenda: compact badge + detail sheet (no tall box per day). Grid: chip + tooltip.
 */

import { useState } from 'react'
import Link from 'next/link'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

function PromoDetailBody({
  ownerLine,
  guestLine,
  walletHint,
  manageLabel,
}) {
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      <p className="font-semibold text-slate-900">{ownerLine}</p>
      <p className="text-slate-700">{guestLine}</p>
      <p className="text-xs text-slate-500">{walletHint}</p>
      <Link
        href="/partner/promo"
        className="inline-block min-h-[44px] py-2 text-sm font-semibold text-brand hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {manageLabel}
      </Link>
    </div>
  )
}

export function CalendarMarketingPromoHint({
  promo,
  baseCurrency,
  formatListingPrice,
  t,
  trTpl,
  variant = 'agenda',
}) {
  const [detailOpen, setDetailOpen] = useState(false)

  if (!promo || typeof formatListingPrice !== 'function') return null

  const code = String(promo.code || 'PROMO').toUpperCase()
  const isPartnerOwned = String(promo.createdByType || '').toUpperCase() === 'PARTNER'
  const guest = formatListingPrice(promo.guestPrice || 0, baseCurrency).primary
  const discount = formatListingPrice(promo.discountAmount || 0, baseCurrency).primary
  const ownerLine = trTpl(
    t(isPartnerOwned ? 'partnerCal_promoOwnerYours' : 'partnerCal_promoOwnerPlatform'),
    { code },
  )
  const guestLine = trTpl(t('partnerCal_promoGuestSees'), { guest, discount })
  const badge = promo.isFlashSale ? t('partnerCal_chipFlash') : t('partnerCal_chipPromo')
  const walletHint = t('partnerCal_promoNotWalletHint')
  const manageLabel = t('partnerCal_promoManage')

  const badgeClass = cn(
    'inline-flex max-w-full items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-none',
    promo.isFlashSale ? 'bg-orange-100 text-orange-700' : 'bg-brand/15 text-brand-hover',
  )

  if (variant === 'chip') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn(badgeClass, 'cursor-help')}>
            {badge}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px] space-y-1 leading-relaxed">
          <p className="font-semibold">{ownerLine}</p>
          <p>{guestLine}</p>
          <p className="text-xs text-slate-500">{walletHint}</p>
          <Link
            href="/partner/promo"
            className="block text-xs font-medium text-brand hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {manageLabel}
          </Link>
        </TooltipContent>
      </Tooltip>
    )
  }

  // agenda (default) — compact badge; details in bottom sheet (Stage 200.40)
  // span (not button): agenda row is already a <button> — nested buttons are invalid.
  return (
    <>
      <span
        role="button"
        tabIndex={0}
        className={cn(
          badgeClass,
          'min-h-[28px] min-w-[44px] cursor-pointer justify-center touch-manipulation',
        )}
        aria-label={`${badge}: ${code}`}
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          setDetailOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return
          e.stopPropagation()
          e.preventDefault()
          setDetailOpen(true)
        }}
      >
        {badge}
        <span className="max-w-[4.5rem] truncate font-bold tracking-wide">{code}</span>
      </span>
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent
          side="bottom"
          fit="content"
          overlayClassName="z-[340]"
          className={cn(
            'z-[350] rounded-t-2xl border-t border-slate-200 px-4 pt-3',
          )}
        >
          <SheetHeader className="mb-3 pr-16 text-left">
            <SheetTitle>{badge}</SheetTitle>
          </SheetHeader>
          <PromoDetailBody
            ownerLine={ownerLine}
            guestLine={guestLine}
            walletHint={walletHint}
            manageLabel={manageLabel}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}
