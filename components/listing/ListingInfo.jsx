/**
 * Guest listing: title/specs (header) + description / policy / host (body).
 * @see `app/listings/[id]/components/ListingHeader.jsx` · `ListingDescription.jsx`
 */

'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  MapPin,
  Star,
  Bed,
  Bath,
  Users,
  Square,
  ShieldCheck,
  Anchor,
  Ship,
  Clock,
  Route,
  Car,
  Info,
} from 'lucide-react'
import { toPublicImageUrl } from '@/lib/public-image-url'
import { getUIText, getListingText, getCategoryName } from '@/lib/translations'
import { resolveListingGuestCapacity } from '@/lib/listing-guest-capacity'
import {
  isTransportListingCategory,
  isTourListingCategory,
  isYachtLikeCategory,
  showsPropertyInteriorSpecs,
} from '@/lib/listing-category-slug'
import { normalizeVehicleModelYearForDisplay } from '@/lib/listing-vehicle-year'
import { ListingCancellationPolicy } from '@/components/listing/ListingCancellationPolicy'
import { PartnerTrustBadge } from '@/components/trust/PartnerTrustBadge'
import { PartnerRenterTrustBadges } from '@/components/trust/PartnerRenterTrustBadges'
import {
  getPublicListingMetadataSpecEntries,
  listingMetadataSpecUiKey,
} from '@/lib/listing-public-metadata-specs'

function useGuestListingModel(listing) {
  return useMemo(() => {
    if (!listing) return null
    const categorySlug = String(listing?.categorySlug || listing?.category?.slug || '').toLowerCase()
    return {
      bedrooms: listing?.metadata?.bedrooms || 0,
      bathrooms: listing?.metadata?.bathrooms || 0,
      categorySlug,
      transportListing: isTransportListingCategory(categorySlug),
      propertyInterior: showsPropertyInteriorSpecs(categorySlug),
      yachtLike: isYachtLikeCategory(categorySlug),
      tourLike: isTourListingCategory(categorySlug),
      maxGuests: resolveListingGuestCapacity(listing),
      area: listing?.metadata?.area || 0,
      vehicleYear: normalizeVehicleModelYearForDisplay(listing?.metadata?.vehicle_year),
      cabins:
        parseInt(
          String(listing?.metadata?.cabins ?? listing?.metadata?.cabins_count ?? '').replace(/\D/g, ''),
          10,
        ) || 0,
      durationHours:
        parseInt(
          String(
            listing?.metadata?.duration_hours ?? listing?.metadata?.tour_hours ?? '',
          ).replace(/\D/g, ''),
          10,
        ) || 0,
      engineCc: parseInt(String(listing?.metadata?.engine_cc ?? '').replace(/\D/g, ''), 10) || 0,
    }
  }, [listing])
}

/**
 * Title, location, rating, and spec row.
 */
export function GuestListingTitleBlock({ listing, language = 'en' }) {
  const m = useGuestListingModel(listing)
  const extraMetadataSpecs = useMemo(
    () => getPublicListingMetadataSpecEntries(listing?.metadata),
    [listing?.metadata],
  )
  if (!m || !listing) return null

  const {
    bedrooms,
    bathrooms,
    categorySlug: _categorySlug,
    transportListing,
    propertyInterior,
    yachtLike,
    tourLike,
    maxGuests,
    area,
    vehicleYear,
    cabins,
    durationHours,
    engineCc,
  } = m

  const ownerVerified =
    listing.ownerVerified === true || listing.owner?.is_verified === true

  return (
    <div>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900 mb-2">
            {listing.title}
          </h1>
          {ownerVerified ? (
            <div className="mb-2">
              <Badge
                variant="secondary"
                className="gap-1 bg-teal-50 text-teal-800 border-teal-200 font-normal"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {getUIText('listingCard_verifiedPartner', language)}
              </Badge>
            </div>
          ) : null}
          <div className="flex items-center gap-4 text-slate-600">
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              <span>{listing.district}</span>
            </div>
            {(listing.rating > 0 || (listing.reviewsCount || 0) > 0) && (
              <a
                href="#reviews"
                className="flex items-center gap-1 hover:text-teal-600 transition-colors cursor-pointer group"
              >
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="font-medium">{(Number(listing.rating) || 0).toFixed(1)}</span>
                <span className="text-slate-400 group-hover:text-teal-500">
                  ({(listing.reviewsCount || 0)} {getUIText('reviews', language)})
                </span>
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6 text-slate-700 py-4 border-y border-slate-100 flex-wrap">
        {propertyInterior && bedrooms > 0 && (
          <div className="flex items-center gap-2">
            <Bed className="h-5 w-5 text-slate-400" />
            <span>
              {bedrooms} {getUIText('listingInfo_bedroomsWord', language)}
            </span>
          </div>
        )}
        {propertyInterior && bathrooms > 0 && (
          <div className="flex items-center gap-2">
            <Bath className="h-5 w-5 text-slate-400" />
            <span>
              {bathrooms} {getUIText('bathrooms', language)}
            </span>
          </div>
        )}
        {yachtLike && (
          <div className="flex items-center gap-2">
            <Anchor className="h-5 w-5 text-slate-400 shrink-0" aria-hidden />
            <span className="font-medium">{getCategoryName('yachts', language, listing?.category?.name)}</span>
          </div>
        )}
        {yachtLike && cabins > 0 && (
          <div className="flex items-center gap-2">
            <Ship className="h-5 w-5 text-slate-400 shrink-0" aria-hidden />
            <span>
              {cabins} {getUIText('listingInfo_cabinsWord', language)}
            </span>
          </div>
        )}
        {tourLike && (
          <div className="flex items-center gap-2">
            <Route className="h-5 w-5 text-slate-400 shrink-0" aria-hidden />
            <span className="font-medium">{getCategoryName('tours', language, listing?.category?.name)}</span>
          </div>
        )}
        {tourLike && durationHours > 0 && (
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-slate-400 shrink-0" aria-hidden />
            <span className="tabular-nums">
              ~{durationHours} {getUIText('listingInfo_tourHoursUnit', language)}
            </span>
          </div>
        )}
        {transportListing && !yachtLike && (
          <div className="flex items-center gap-2">
            <Car className="h-5 w-5 text-slate-400 shrink-0" aria-hidden />
            <span className="font-medium">
              {getCategoryName('vehicles', language, listing?.category?.name)}
            </span>
          </div>
        )}
        {transportListing && !yachtLike && engineCc > 0 && (
          <span className="text-sm tabular-nums text-slate-600">
            {getUIText('listingInfo_engineCcLabel', language).replace(/\{\{cc\}\}/g, String(engineCc))}
          </span>
        )}
        {transportListing && !yachtLike && vehicleYear != null && (
          <div className="flex items-center gap-2 text-slate-700">
            <span>
              {getUIText('listingModelYear', language)}:{' '}
              <span className="font-medium tabular-nums">{vehicleYear}</span>
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-slate-400" />
          <span>
            {transportListing && !yachtLike
              ? `${maxGuests} ${getUIText('seats', language)}`
              : getUIText('listingUpToGuests', language).replace(/\{\{n\}\}/g, String(maxGuests))}
          </span>
        </div>
        {propertyInterior && area > 0 && (
          <div className="flex items-center gap-2">
            <Square className="h-5 w-5 text-slate-400" />
            <span>{getUIText('listingInfo_areaSqm', language).replace(/\{\{n\}\}/g, String(area))}</span>
          </div>
        )}
        {extraMetadataSpecs.map(({ key, value }) => {
          const uiKey = listingMetadataSpecUiKey(key)
          const labelRaw = getUIText(uiKey, language)
          const label = labelRaw !== uiKey ? labelRaw : key.replace(/_/g, ' ')
          return (
            <div key={key} className="flex items-center gap-2 text-slate-700">
              <Info className="h-5 w-5 text-slate-400 shrink-0" aria-hidden />
              <span className="tabular-nums">
                <span className="text-slate-500">{label}: </span>
                {value}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Long description, cancellation, host.
 */
export function GuestListingBodyBlock({ listing, language = 'en' }) {
  if (!listing) return null
  return (
    <div className="space-y-0">
      <div>
        <h2 className="text-2xl font-medium tracking-tight mb-4">{getUIText('description', language)}</h2>
        <p className="text-base leading-relaxed text-slate-600 whitespace-pre-wrap">
          {getListingText(listing, 'description', language) || listing.description}
        </p>
      </div>

      <Separator className="my-8" />
      <ListingCancellationPolicy
        policy={listing?.cancellationPolicy ?? listing?.cancellation_policy}
        language={language}
      />

      {listing.owner ? (
        <>
          <Separator className="my-8" />
          <div>
            <h2 className="text-2xl font-medium tracking-tight mb-4">{getUIText('meetYourHost', language)}</h2>
            <Card className="border-slate-200">
              <CardContent className="p-6">
                <Link
                  href={listing.owner?.id ? `/u/${listing.owner.id}` : '#'}
                  className={`group flex items-center gap-4 rounded-xl -m-2 p-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                    listing.owner?.id ? 'hover:bg-slate-50' : 'pointer-events-none opacity-80'
                  }`}
                  aria-label={getUIText('publicProfileOpenHostHint', language)}
                >
                  <Avatar className="h-16 w-16 border border-slate-200">
                    {listing.owner.avatar ? (
                      <AvatarImage
                        src={toPublicImageUrl(listing.owner.avatar)}
                        alt=""
                        className="object-cover"
                      />
                    ) : null}
                    <AvatarFallback className="bg-teal-100 text-teal-700 text-lg font-semibold">
                      {(listing.owner.first_name?.charAt(0) || listing.owner.last_name?.charAt(0) || '?').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <h3 className="font-medium text-lg text-slate-900 group-hover:text-teal-800">
                      {[listing.owner.first_name, listing.owner.last_name].filter(Boolean).join(' ').trim() ||
                        getUIText('hostNamePlaceholder', language)}
                    </h3>
                    <p className="text-sm text-slate-500">{getUIText('propertyOwner', language)}</p>
                    {listing.partnerTrust ? (
                      <div className="pt-2 space-y-1.5">
                        <PartnerTrustBadge trust={listing.partnerTrust} language={language} />
                        <PartnerRenterTrustBadges trust={listing.partnerTrust} language={language} />
                      </div>
                    ) : null}
                  </div>
                </Link>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  )
}

export function ListingInfo({ listing, language = 'en' }) {
  return (
    <div className="space-y-8">
      <GuestListingTitleBlock listing={listing} language={language} />
      <Separator />
      <GuestListingBodyBlock listing={listing} language={language} />
    </div>
  )
}
