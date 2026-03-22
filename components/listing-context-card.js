import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { MapPin, Calendar } from 'lucide-react'
import { formatPrice } from '@/lib/currency'
import { toStorageProxyUrl } from '@/lib/supabase-proxy-urls'

export function ListingContextCard({ listing, checkIn, checkOut, className = '' }) {
  if (!listing) return null

  const days = checkIn && checkOut
    ? Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24))
    : 1

  const thumb =
    toStorageProxyUrl(listing.coverImage || listing.cover_image || listing.images?.[0]) ||
    '/placeholder.svg'

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
          />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-slate-900 text-sm line-clamp-2">
            {listing.title}
          </h4>
          <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
            <MapPin className="h-3 w-3" />
            <span>{listing.district}</span>
          </div>
          {checkIn && checkOut && (
            <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
              <Calendar className="h-3 w-3" />
              <span>
                {new Date(checkIn).toLocaleDateString('ru-RU')} -
                {new Date(checkOut).toLocaleDateString('ru-RU')}
              </span>
            </div>
          )}
          <div className="mt-2 font-semibold text-teal-600 text-sm">
            {formatPrice((listing.basePriceThb || listing.base_price_thb || 0) * days, 'THB')}
          </div>
        </div>
      </div>
    </Card>
  )
}
