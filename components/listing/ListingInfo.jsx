/**
 * ListingInfo Component
 * Displays listing description, specifications, and host information
 */

'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { MapPin, Star, Bed, Bath, Users, Square, ShieldCheck } from 'lucide-react'
import { toPublicImageUrl } from '@/lib/public-image-url'
import { getUIText, getListingText } from '@/lib/translations'
import { resolveListingGuestCapacity } from '@/lib/listing-guest-capacity'
import { isTransportListingCategory } from '@/lib/listing-category-slug'

export function ListingInfo({ listing, language = 'en' }) {
  const bedrooms = listing?.metadata?.bedrooms || 0
  const bathrooms = listing?.metadata?.bathrooms || 0
  const categorySlug = String(listing?.categorySlug || listing?.category?.slug || '').toLowerCase()
  const transportListing = isTransportListingCategory(categorySlug)
  const maxGuests = resolveListingGuestCapacity(listing)
  const area = listing?.metadata?.area || 0
  const vehicleYear = listing?.metadata?.vehicle_year
  
  return (
    <div className="space-y-8">
      {/* Title & Location */}
      <div>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900 mb-2">
              {listing.title}
            </h1>
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
        
        {/* Specs */}
        <div className="flex items-center gap-6 text-slate-700 py-4 border-y border-slate-100 flex-wrap">
          {!transportListing && bedrooms > 0 && (
            <div className="flex items-center gap-2">
              <Bed className="h-5 w-5 text-slate-400" />
              <span>{bedrooms} {language === 'ru' ? 'спален' : 'bedrooms'}</span>
            </div>
          )}
          {!transportListing && bathrooms > 0 && (
            <div className="flex items-center gap-2">
              <Bath className="h-5 w-5 text-slate-400" />
              <span>{bathrooms} {getUIText('bathrooms', language)}</span>
            </div>
          )}
          {transportListing && vehicleYear != null && String(vehicleYear).trim() !== '' && (
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
              {transportListing
                ? `${maxGuests} ${getUIText('seats', language)}`
                : getUIText('listingUpToGuests', language).replace(/\{\{n\}\}/g, String(maxGuests))}
            </span>
          </div>
          {!transportListing && area > 0 && (
            <div className="flex items-center gap-2">
              <Square className="h-5 w-5 text-slate-400" />
              <span>{area} m²</span>
            </div>
          )}
        </div>
      </div>
      
      <Separator />
      
      {/* Description */}
      <div>
        <h2 className="text-2xl font-medium tracking-tight mb-4">
          {getUIText('description', language)}
        </h2>
        <p className="text-base leading-relaxed text-slate-600 whitespace-pre-wrap">
          {getListingText(listing, 'description', language) || listing.description}
        </p>
      </div>
      
      <Separator />
      
      {/* Host Section */}
      {listing.owner && (
        <>
          <div>
            <h2 className="text-2xl font-medium tracking-tight mb-4">
              {getUIText('meetYourHost', language)}
            </h2>
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
                    <p className="text-sm text-slate-500">
                      {getUIText('propertyOwner', language)}
                    </p>
                    {listing.owner.is_verified ? (
                      <Badge variant="secondary" className="gap-1 bg-teal-50 text-teal-800 border-teal-200 font-normal">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {getUIText('hostIdentityVerified', language)}
                      </Badge>
                    ) : null}
                  </div>
                </Link>
              </CardContent>
            </Card>
          </div>
          <Separator />
        </>
      )}
    </div>
  )
}
