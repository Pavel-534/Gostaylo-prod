/**
 * Guest listing: title/specs (header) + description / policy / host (body).
 * @see `app/listings/[id]/components/ListingHeader.jsx` · `ListingDescription.jsx`
 */

'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { MapPin, Star, ShieldCheck } from 'lucide-react'
import { toPublicImageUrl } from '@/lib/public-image-url'
import { resolveAvatarDisplaySrc } from '@/lib/image-display-url'
import { getUIText, getListingText } from '@/lib/translations'
import { ListingCardSpecsRow } from '@/components/listing/ListingCardSpecsRow'
import { ListingGuestPolicies } from '@/components/listing/ListingStayPolicies'
import { listingHasGuestPolicies } from '@/lib/listing/listing-good-to-know'
import { PartnerTrustBadge } from '@/components/trust/PartnerTrustBadge'
import { PartnerRenterTrustBadges } from '@/components/trust/PartnerRenterTrustBadges'

/**
 * Title, location, rating, and spec row (SSOT: `ListingCardSpecsRow`).
 */
export function GuestListingTitleBlock({ listing, language = 'en' }) {
  if (!listing) return null

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
                className="gap-1 bg-brand/10 text-brand-hover border-brand/25 font-normal"
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
            {Number(listing.rating || listing.average_rating || listing.avgRating || 0) > 0 && (
              <a
                href="#reviews"
                className="flex items-center gap-1 hover:text-brand transition-colors cursor-pointer group"
              >
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="font-medium">
                  {(Number(listing.rating || listing.average_rating || listing.avgRating) || 0).toFixed(1)}
                </span>
                <span className="text-slate-400 group-hover:text-brand/70">
                  ({(listing.reviewsCount || 0)} {getUIText('reviews', language)})
                </span>
              </a>
            )}
          </div>
        </div>
      </div>

      <ListingCardSpecsRow
        listing={listing}
        language={language}
        variant="pdp"
        suppressTrustVerifiedMiniBadge
        className="py-4 border-y border-slate-100"
      />
    </div>
  )
}

/**
 * Long description, policies, host.
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

      {listingHasGuestPolicies(listing) ? (
        <>
          <Separator className="my-8" />
          <ListingGuestPolicies listing={listing} language={language} />
        </>
      ) : null}

      {listing.owner ? (
        <>
          <Separator className="my-8" />
          <div>
            <h2 className="text-2xl font-medium tracking-tight mb-4">{getUIText('meetYourHost', language)}</h2>
            <Card className="border-slate-200">
              <CardContent className="p-6">
                <Link
                  href={listing.owner?.id ? `/u/${listing.owner.id}` : '#'}
                  className={`group flex items-center gap-4 rounded-xl -m-2 p-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    listing.owner?.id ? 'hover:bg-slate-50' : 'pointer-events-none opacity-80'
                  }`}
                  aria-label={getUIText('publicProfileOpenHostHint', language)}
                >
                  <Avatar className="h-16 w-16 border border-slate-200">
                    {listing.owner.avatar ? (
                      <AvatarImage
                        src={resolveAvatarDisplaySrc(listing.owner.avatar) || ''}
                        alt=""
                        className="object-cover"
                      />
                    ) : null}
                    <AvatarFallback className="bg-brand/15 text-brand-hover text-lg font-semibold">
                      {(listing.owner.first_name?.charAt(0) || listing.owner.last_name?.charAt(0) || '?').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <h3 className="font-medium text-lg text-slate-900 group-hover:text-brand-hover">
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
