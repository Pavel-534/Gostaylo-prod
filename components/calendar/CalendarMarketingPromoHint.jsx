'use client'

/**
 * Partner calendar — marketing promo hint (trust-oriented, Stage 200.5).
 * Guest-facing discount preview + manage link; no raw «price − x = y» formula.
 */

import Link from 'next/link'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export function CalendarMarketingPromoHint({
  promo,
  baseCurrency,
  formatListingPrice,
  t,
  trTpl,
  variant = 'agenda',
}) {
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

  if (variant === 'chip') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex max-w-full cursor-help items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-none',
              promo.isFlashSale ? 'bg-orange-100 text-orange-700' : 'bg-brand/15 text-brand-hover',
            )}
          >
            {badge}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px] space-y-1 leading-relaxed">
          <p className="font-semibold">{ownerLine}</p>
          <p>{guestLine}</p>
          <p className="text-xs text-slate-500">{t('partnerCal_promoNotWalletHint')}</p>
          <Link
            href="/partner/promo"
            className="block text-xs font-medium text-brand hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {t('partnerCal_promoManage')}
          </Link>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div className="mt-1 w-full max-w-full rounded-lg border border-brand/20 bg-brand/5 px-2 py-1.5 text-right leading-tight">
      <div className="flex items-center justify-end gap-1">
        <span
          className={cn(
            'inline-block rounded px-1 py-px text-[8px] font-bold uppercase tracking-wide text-white',
            promo.isFlashSale ? 'bg-orange-600' : 'bg-brand',
          )}
        >
          {badge}
        </span>
      </div>
      <p className="mt-0.5 text-[10px] font-semibold text-slate-800">{ownerLine}</p>
      <p className="text-[10px] font-medium tabular-nums text-slate-600">{guestLine}</p>
      <p className="mt-0.5 text-[9px] text-slate-500">{t('partnerCal_promoNotWalletHint')}</p>
      <Link
        href="/partner/promo"
        className="mt-0.5 inline-block text-[10px] font-semibold text-brand hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {t('partnerCal_promoManage')}
      </Link>
    </div>
  )
}
