'use client'

/**
 * Единый ряд характеристик карточки листинга (каталог / главная / поиск).
 * Вертикаль — `lib/listing-card-spec-profile.js` (wizard_profile + slug).
 */

import {
  BedDouble,
  Bath,
  Users,
  Maximize,
  Anchor,
  Ship,
  Clock,
  Route,
  Car,
  Cog,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUIText, getCategoryName } from '@/lib/translations'
import {
  resolveListingCardSpecVertical,
  getListingCardBedrooms,
  getListingCardBathrooms,
  getListingCardCabins,
  getListingCardEngineCc,
  formatListingTransmissionLabel,
  getListingCardDurationHours,
  getListingCardGuestCapacity,
  listingQualifiesForTrustVerifiedMiniBadge,
} from '@/lib/listing-card-spec-profile'
import { ListingTrustVerifiedMiniBadge } from '@/components/listing/ListingTrustVerifiedMiniBadge'

export function ListingCardSpecsRow({
  listing,
  language = 'en',
  compact = false,
  className,
  suppressTrustVerifiedMiniBadge = false,
}) {
  const vertical = resolveListingCardSpecVertical(listing)
  const meta = listing.metadata && typeof listing.metadata === 'object' ? listing.metadata : {}
  const bedrooms = getListingCardBedrooms(listing)
  const bathrooms = getListingCardBathrooms(listing)
  const cabins = getListingCardCabins(listing)
  const engineCc = getListingCardEngineCc(listing)
  const transmission = formatListingTransmissionLabel(meta, language)
  const durationHours = getListingCardDurationHours(listing)
  const cap = getListingCardGuestCapacity(listing)
  const area = Number(meta.area ?? 0) || 0

  const iconCls = compact ? 'h-3 w-3 shrink-0' : 'h-4 w-4 shrink-0'
  const textCls = compact ? 'text-xs text-slate-500' : 'text-sm text-slate-500'

  const showTransportExtras = engineCc > 0 || Boolean(transmission)
  const showVerifiedMini = listingQualifiesForTrustVerifiedMiniBadge(listing)
  const showRow =
    cap > 0 ||
    vertical === 'yacht' ||
    (vertical === 'housing' && (bedrooms > 0 || bathrooms > 0 || area > 0)) ||
    (vertical === 'transport' && (showTransportExtras || cap > 0)) ||
    (vertical === 'tour' && (durationHours > 0 || cap > 0)) ||
    (vertical === 'compact' && cap > 0)

  if (!showRow && !showVerifiedMini) return null

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-500 mb-3',
        textCls,
        className,
      )}
    >
      {!suppressTrustVerifiedMiniBadge && showVerifiedMini ? (
        <ListingTrustVerifiedMiniBadge
          listing={listing}
          language={language}
          compact={compact}
        />
      ) : null}
      {vertical === 'housing' && bedrooms > 0 && (
        <div className="flex items-center gap-1" title={getUIText('bedrooms', language)}>
          <BedDouble className={iconCls} aria-hidden />
          <span>{bedrooms}</span>
        </div>
      )}
      {vertical === 'housing' && bathrooms > 0 && (
        <div className="flex items-center gap-1" title={getUIText('bathrooms', language)}>
          <Bath className={iconCls} aria-hidden />
          <span>{bathrooms}</span>
        </div>
      )}

      {vertical === 'yacht' && (
        <div className="flex items-center gap-1" title={getCategoryName('yachts', language)}>
          <Anchor className={iconCls} aria-hidden />
        </div>
      )}
      {vertical === 'yacht' && cabins > 0 && (
        <div
          className="flex items-center gap-1"
          title={language === 'ru' ? 'Кают' : 'Cabins'}
        >
          <Ship className={iconCls} aria-hidden />
          <span>{cabins}</span>
        </div>
      )}

      {vertical === 'tour' && (
        <div className="flex items-center gap-1" title={getCategoryName('tours', language)}>
          <Route className={iconCls} aria-hidden />
        </div>
      )}
      {vertical === 'tour' && durationHours > 0 && (
        <div className="flex items-center gap-1" title={language === 'ru' ? 'Часы' : 'Hours'}>
          <Clock className={iconCls} aria-hidden />
          <span>{durationHours}h</span>
        </div>
      )}

      {vertical === 'transport' && (
        <div className="flex items-center gap-1" title={getCategoryName('vehicles', language)}>
          <Car className={iconCls} aria-hidden />
        </div>
      )}
      {vertical === 'transport' && engineCc > 0 && (
        <span
          className={cn(
            'tabular-nums font-medium text-slate-600',
            compact ? 'text-xs' : 'text-sm',
          )}
        >
          {engineCc} cc
        </span>
      )}
      {vertical === 'transport' && transmission ? (
        <div
          className="flex min-w-0 max-w-[140px] items-center gap-0.5"
          title={transmission}
        >
          <Cog className={cn(iconCls, 'shrink-0 text-slate-400')} aria-hidden />
          <span className="truncate">{transmission}</span>
        </div>
      ) : null}

      {cap > 0 && (
        <div
          className="flex items-center gap-1"
          title={
            vertical === 'transport'
              ? getUIText('numberOfSeats', language)
              : getUIText('guests', language)
          }
        >
          <Users className={iconCls} aria-hidden />
          <span>{cap}</span>
        </div>
      )}

      {vertical === 'housing' && area > 0 && (
        <div className="flex items-center gap-1" title={getUIText('area', language)}>
          <Maximize className={iconCls} aria-hidden />
          <span>{area}m²</span>
        </div>
      )}
    </div>
  )
}
