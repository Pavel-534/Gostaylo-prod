'use client'

/**
 * Stage 201.86 — PDP: fees / fuel policy visible before dates (not only inside price breakdown).
 * Stage 201.94 — cleaning/deposit amounts stay in listing THB (no header FX).
 */
import { Info } from 'lucide-react'
import { getUIText } from '@/lib/translations'
import {
  buildGuestPriceExclusionHints,
  formatGuestOnSiteFeeAmount,
} from '@/lib/booking/guest-price-exclusions.js'
import { LISTING_PDP_SECTION_TITLE_CLASS } from '@/lib/listing/pdp-section-rhythm'
import { cn } from '@/lib/utils'

/**
 * @param {object} props
 * @param {object} props.listing
 * @param {string} [props.language]
 */
export function ListingGuestFeeHints({ listing, language = 'ru' }) {
  const slug = listing?.categorySlug || listing?.category?.slug || ''
  const meta = listing?.metadata && typeof listing.metadata === 'object' ? listing.metadata : {}
  const hints = buildGuestPriceExclusionHints(slug, meta)
  if (!hints.length) return null

  return (
    <div data-testid="listing-guest-fee-hints">
      <h2 className={cn(LISTING_PDP_SECTION_TITLE_CLASS, 'mb-4')}>
        {getUIText('orderExcluded_title', language)}
      </h2>
      <ul className="space-y-2 text-sm leading-relaxed text-slate-600">
        {hints.map((h) => {
          let text = getUIText(h.key, language)
          if (h.amountThb != null && Number(h.amountThb) > 0) {
            text = text.replace(/\{\{amount\}\}/g, formatGuestOnSiteFeeAmount(h.amountThb, language))
          }
          return (
            <li key={h.key} className="flex gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
              <span>{text}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * @param {object|null|undefined} listing
 */
export function listingHasGuestFeeHints(listing) {
  if (!listing) return false
  const slug = listing?.categorySlug || listing?.category?.slug || ''
  const meta = listing?.metadata && typeof listing.metadata === 'object' ? listing.metadata : {}
  return buildGuestPriceExclusionHints(slug, meta).length > 0
}
