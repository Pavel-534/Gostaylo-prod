'use client'

/**
 * Единый ряд характеристик листинга (каталог / PDP / главная).
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
  Fuel,
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
  formatListingFuelTypeLabel,
  getListingCardDurationHours,
  getListingCardGuestCapacity,
  getListingCardArea,
  getListingCardVehicleYear,
  listingQualifiesForTrustVerifiedMiniBadge,
} from '@/lib/listing-card-spec-profile'
import { ListingTrustVerifiedMiniBadge } from '@/components/listing/ListingTrustVerifiedMiniBadge'

export function ListingCardSpecsRow({
  listing,
  language = 'en',
  compact = false,
  /** @type {'card' | 'pdp'} */
  variant = 'card',
  className,
  suppressTrustVerifiedMiniBadge = false,
}) {
  const isPdp = variant === 'pdp'
  const vertical = resolveListingCardSpecVertical(listing)
  const meta = listing.metadata && typeof listing.metadata === 'object' ? listing.metadata : {}
  const bedrooms = getListingCardBedrooms(listing)
  const bathrooms = getListingCardBathrooms(listing)
  const cabins = getListingCardCabins(listing)
  const engineCc = getListingCardEngineCc(listing)
  const transmission = formatListingTransmissionLabel(meta, language)
  const fuelType = formatListingFuelTypeLabel(meta, language)
  const vehicleYear = getListingCardVehicleYear(listing)
  const durationHours = getListingCardDurationHours(listing)
  const cap = getListingCardGuestCapacity(listing)
  const area = getListingCardArea(listing)

  const iconCls = isPdp
    ? 'h-5 w-5 shrink-0 text-slate-400'
    : compact
      ? 'h-3 w-3 shrink-0'
      : 'h-4 w-4 shrink-0'
  const textCls = isPdp
    ? 'text-base text-slate-700'
    : compact
      ? 'text-xs text-slate-500'
      : 'text-sm text-slate-500'

  const showTransportExtras = engineCc > 0 || Boolean(transmission) || Boolean(fuelType) || vehicleYear != null
  const showVerifiedMini = listingQualifiesForTrustVerifiedMiniBadge(listing)
  const showRow =
    cap > 0 ||
    vertical === 'yacht' ||
    (vertical === 'housing' && (bedrooms > 0 || bathrooms > 0 || area > 0)) ||
    (vertical === 'transport' && (showTransportExtras || cap > 0)) ||
    (vertical === 'tour' && (durationHours > 0 || cap > 0)) ||
    (vertical === 'compact' && cap > 0)

  if (!showRow && !showVerifiedMini) return null

  const categoryName = (slug, fallbackName) =>
    getCategoryName(slug, language, fallbackName || listing?.category?.name)

  return (
    <div
      className={cn(
        'flex flex-wrap items-center',
        isPdp ? 'gap-x-6 gap-y-3' : 'gap-x-2 gap-y-2 sm:gap-x-4',
        isPdp ? '' : 'mb-3',
        textCls,
        className,
      )}
    >
      {!suppressTrustVerifiedMiniBadge && showVerifiedMini ? (
        <ListingTrustVerifiedMiniBadge
          listing={listing}
          language={language}
          compact={compact && !isPdp}
        />
      ) : null}

      {vertical === 'housing' && bedrooms > 0 && (
        <div className="flex items-center gap-2" title={getUIText('bedrooms', language)}>
          <BedDouble className={iconCls} aria-hidden />
          <span>
            {isPdp
              ? `${bedrooms} ${getUIText('listingInfo_bedroomsWord', language)}`
              : bedrooms}
          </span>
        </div>
      )}
      {vertical === 'housing' && bathrooms > 0 && (
        <div className="flex items-center gap-2" title={getUIText('bathrooms', language)}>
          <Bath className={iconCls} aria-hidden />
          <span>
            {isPdp ? `${bathrooms} ${getUIText('bathrooms', language)}` : bathrooms}
          </span>
        </div>
      )}

      {vertical === 'yacht' && (
        <div className="flex items-center gap-2" title={categoryName('yachts')}>
          <Anchor className={iconCls} aria-hidden />
          {isPdp ? <span className="font-medium">{categoryName('yachts')}</span> : null}
        </div>
      )}
      {vertical === 'yacht' && cabins > 0 && (
        <div
          className="flex items-center gap-2"
          title={language === 'ru' ? 'Кают' : 'Cabins'}
        >
          <Ship className={iconCls} aria-hidden />
          <span>
            {isPdp
              ? `${cabins} ${getUIText('listingInfo_cabinsWord', language)}`
              : cabins}
          </span>
        </div>
      )}

      {vertical === 'tour' && (
        <div className="flex items-center gap-2" title={categoryName('tours')}>
          <Route className={iconCls} aria-hidden />
          {isPdp ? <span className="font-medium">{categoryName('tours')}</span> : null}
        </div>
      )}
      {vertical === 'tour' && durationHours > 0 && (
        <div className="flex items-center gap-2" title={language === 'ru' ? 'Часы' : 'Hours'}>
          <Clock className={iconCls} aria-hidden />
          <span className="tabular-nums">
            {isPdp
              ? `~${durationHours} ${getUIText('listingInfo_tourHoursUnit', language)}`
              : `${durationHours}h`}
          </span>
        </div>
      )}

      {vertical === 'transport' && (
        <div className="flex items-center gap-2" title={categoryName('vehicles')}>
          <Car className={iconCls} aria-hidden />
          {isPdp ? (
            <span className="font-medium">{categoryName('vehicles', listing?.category?.name)}</span>
          ) : null}
        </div>
      )}
      {vertical === 'transport' && engineCc > 0 && (
        <span
          className={cn('tabular-nums', isPdp ? 'text-slate-600' : 'font-medium text-slate-600')}
        >
          {isPdp
            ? getUIText('listingInfo_engineCcLabel', language).replace(/\{\{cc\}\}/g, String(engineCc))
            : `${engineCc} cc`}
        </span>
      )}
      {vertical === 'transport' && transmission ? (
        <div
          className={cn(
            'flex min-w-0 items-center gap-2',
            isPdp ? 'max-w-[220px]' : 'max-w-[140px] gap-0.5',
          )}
          title={transmission}
        >
          <Cog className={iconCls} aria-hidden />
          <span className="truncate">{transmission}</span>
        </div>
      ) : null}
      {vertical === 'transport' && fuelType ? (
        <div
          className="flex min-w-0 items-center gap-2"
          title={getUIText('fieldFuelType', language)}
        >
          <Fuel className={iconCls} aria-hidden />
          <span>{fuelType}</span>
        </div>
      ) : null}
      {vertical === 'transport' && vehicleYear != null && (
        <div className="flex items-center gap-2">
          {isPdp ? (
            <span>
              {getUIText('listingModelYear', language)}:{' '}
              <span className="font-medium tabular-nums">{vehicleYear}</span>
            </span>
          ) : (
            <span className="tabular-nums">{vehicleYear}</span>
          )}
        </div>
      )}

      {cap > 0 && (
        <div
          className="flex items-center gap-2"
          title={
            vertical === 'transport'
              ? getUIText('numberOfSeats', language)
              : getUIText('guests', language)
          }
        >
          <Users className={iconCls} aria-hidden />
          <span>
            {isPdp && vertical === 'transport'
              ? `${cap} ${getUIText('seats', language)}`
              : isPdp && vertical !== 'transport'
                ? getUIText('listingUpToGuests', language).replace(/\{\{n\}\}/g, String(cap))
                : cap}
          </span>
        </div>
      )}

      {vertical === 'housing' && area > 0 && (
        <div className="flex items-center gap-2" title={getUIText('area', language)}>
          <Maximize className={iconCls} aria-hidden />
          <span>
            {isPdp
              ? getUIText('listingInfo_areaSqm', language).replace(/\{\{n\}\}/g, String(area))
              : `${area}m²`}
          </span>
        </div>
      )}
    </div>
  )
}
