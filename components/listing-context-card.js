import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { MapPin, Calendar } from 'lucide-react'
import { formatNativeAmountInCurrency, formatThbAmountAsCode, languageToNumberLocale } from '@/lib/currency'
import { isRemoteHttpImageSrc } from '@/lib/public-image-url'
import { resolveImageThumbDisplayUrl } from '@/lib/image-display-url'
import { getListingCardBlurDataURL } from '@/lib/listing-image-blur'
import {
  getSameCurrencyGuestNativeAmount,
  resolveListingBaseCurrencyCode,
} from '@/lib/pricing/same-currency-guest-display'
import { formatListingLocationLineSync } from '@/lib/locations/geo-display-label'

export function ListingContextCard({ listing, checkIn, checkOut, className = '', language = 'ru' }) {
  if (!listing) return null

  const days = checkIn && checkOut
    ? Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24))
    : 1

  const thumb =
    resolveImageThumbDisplayUrl(
      listing.coverImage || listing.cover_image || listing.images?.[0],
    ) || '/placeholder.svg'

  const baseCur = resolveListingBaseCurrencyCode(listing) || 'THB'
  const nativePerNight = getSameCurrencyGuestNativeAmount(listing, baseCur)
  const priceLabel =
    nativePerNight != null
      ? formatNativeAmountInCurrency(nativePerNight * days, baseCur, language)
      : formatThbAmountAsCode(
          (listing.basePriceThb || listing.base_price_thb || 0) * days,
          language,
        )

  const locationLabel = formatListingLocationLineSync(listing, language)

  return (
    <Card className={`overflow-hidden ${className}`}>
      <div className="flex gap-3 p-3">
        <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden">
          <Image
            src={thumb}
            alt={listing.title}
            width={80}
            height={80}
            className="object-cover"
            placeholder="blur"
            blurDataURL={getListingCardBlurDataURL(listing)}
            unoptimized={isRemoteHttpImageSrc(thumb)}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-slate-900 text-sm line-clamp-2">
            {listing.title}
          </h4>
          {locationLabel ? (
            <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
              <MapPin className="h-3 w-3" />
              <span>{locationLabel}</span>
            </div>
          ) : null}
          {checkIn && checkOut && (
            <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
              <Calendar className="h-3 w-3" />
              <span>
                {new Date(checkIn).toLocaleDateString(languageToNumberLocale(language))} –
                {new Date(checkOut).toLocaleDateString(languageToNumberLocale(language))}
              </span>
            </div>
          )}
          <div className="mt-2 font-semibold text-brand text-sm">{priceLabel}</div>
        </div>
      </div>
    </Card>
  )
}
