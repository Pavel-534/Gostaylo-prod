/**
 * Gostaylo - Interactive Search Map (Airbnb-style)
 * Desktop: 50/50 split (List Left, Map Right)
 * Mobile: Toggle between List and Map
 *
 * Приватность: lib/listing-location-privacy.js → getListingLocationDisplayMode (slug + legacy categoryId).
 * Листинги с родителя: желательно из LISTINGS_SEARCH_API_PATH (@/lib/search-endpoints), чтобы был category.slug.
 * После CONFIRMED/PAID — точный маркер (оранжевый), иначе круг ~500 м или маркер.
 */

'use client'

import { Fragment, useEffect, useState, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Circle, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Star } from 'lucide-react'
import { getUIText } from '@/lib/translations'
import { toPublicImageUrl } from '@/lib/public-image-url'
import { getListingLocationDisplayMode } from '@/lib/listing-location-privacy'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const createCustomIcon = (color = 'teal') => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color === 'teal' ? '#14b8a6' : '#f97316'};
        width: 32px;
        height: 32px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 3px solid white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      "></div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, 32],
  })
}

function getListingPosition(listing) {
  const lat = listing.latitude ?? listing.lat
  const lng = listing.longitude ?? listing.lng
  if (lat != null && lng != null) {
    return [parseFloat(lat), parseFloat(lng)]
  }
  return null
}

function listingCategorySlug(listing) {
  return listing.categorySlug ?? listing.category?.slug ?? null
}

function listingLocationBounds(listing, hasConfirmedBookingFn) {
  const pos = getListingPosition(listing)
  if (!pos) return null
  const booked = hasConfirmedBookingFn(listing.id)
  if (booked) {
    return L.latLngBounds(pos, pos)
  }
  const mode = getListingLocationDisplayMode({
    categorySlug: listingCategorySlug(listing),
    categoryId: listing.category_id ?? listing.categoryId,
  })
  if (mode === 'privacy') {
    return L.circle(pos, { radius: 500 }).getBounds()
  }
  return L.latLngBounds(pos, pos)
}

function MapBoundsUpdater({ listings, hasConfirmedBooking }) {
  const map = useMap()

  const hasConfirmedBookingFn = useCallback(
    (listingId) => hasConfirmedBooking(listingId),
    [hasConfirmedBooking]
  )

  useEffect(() => {
    if (!listings?.length) return
    let bounds = null
    for (const listing of listings) {
      const b = listingLocationBounds(listing, hasConfirmedBookingFn)
      if (!b || !b.isValid()) continue
      bounds = bounds ? bounds.extend(b) : b
    }
    if (bounds?.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 })
    }
  }, [listings, map, hasConfirmedBookingFn])

  return null
}

function ListingPopupCard({ listing, language = 'ru', isApproximateLocation }) {
  const raw = listing.images?.[0] || listing.coverImage || '/placeholder.svg'
  const image = raw ? toPublicImageUrl(raw) || raw : raw
  const price = listing.basePriceThb || listing.base_price_thb || 0
  const rating = listing.rating || 0
  const locHint = getUIText(
    isApproximateLocation ? 'mapListing_approximatePopup' : 'mapListing_exactPopup',
    language
  )

  return (
    <div className="w-64">
      <img src={image} alt={listing.title} className="w-full h-32 object-cover rounded-t-lg" />
      <div className="p-3 bg-white rounded-b-lg">
        <h3 className="font-semibold text-sm text-slate-900 truncate mb-1">{listing.title}</h3>
        <div className="flex items-center gap-1 mb-2">
          {rating > 0 ? (
            <>
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              <span className="text-xs font-medium text-slate-700">{rating.toFixed(1)}</span>
              {listing.reviewsCount > 0 && (
                <span className="text-xs text-slate-500">({listing.reviewsCount})</span>
              )}
            </>
          ) : (
            <span className="text-xs text-slate-400">{getUIText('newListing', language)}</span>
          )}
        </div>
        <p className="text-[11px] text-slate-500 mb-2 leading-snug">{locHint}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-bold text-teal-600">฿{price.toLocaleString()}</span>
          <span className="text-xs text-slate-500">/ {getUIText('perNight', language)}</span>
        </div>
        <a
          href={`/listings/${listing.id}`}
          className="mt-2 block w-full bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium py-1.5 px-3 rounded-lg text-center transition-colors"
        >
          {getUIText('viewDetails', language)}
        </a>
      </div>
    </div>
  )
}

function getMarkerVisualConfig(listing, hasConfirmedBookingFn) {
  const listingId = listing.id
  if (hasConfirmedBookingFn(listingId)) {
    return {
      showCircle: false,
      icon: createCustomIcon('orange'),
      isApproximatePopup: false,
    }
  }
  const mode = getListingLocationDisplayMode({
    categorySlug: listingCategorySlug(listing),
    categoryId: listing.category_id ?? listing.categoryId,
  })
  if (mode === 'privacy') {
    return {
      showCircle: true,
      radius: 500,
      icon: null,
      isApproximatePopup: true,
    }
  }
  return {
    showCircle: false,
    icon: createCustomIcon('teal'),
    isApproximatePopup: false,
  }
}

export default function InteractiveSearchMap({
  listings = [],
  userBookings = [],
  userId = null,
  language = 'ru',
  center = [7.8804, 98.3923],
  zoom = 12,
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const hasConfirmedBooking = useCallback(
    (listingId) => {
      if (!userId || !userBookings?.length) return false
      return userBookings.some(
        (booking) =>
          booking.listing_id === listingId &&
          (booking.status === 'CONFIRMED' || booking.status === 'PAID')
      )
    },
    [userId, userBookings]
  )

  if (!mounted) {
    return (
      <div className="w-full h-full bg-slate-100 animate-pulse rounded-lg flex items-center justify-center">
        <span className="text-slate-400">Loading map...</span>
      </div>
    )
  }

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className="w-full h-full rounded-lg"
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapBoundsUpdater listings={listings} hasConfirmedBooking={hasConfirmedBooking} />

      {listings.map((listing) => {
        const position = getListingPosition(listing)
        if (!position) return null
        const cfg = getMarkerVisualConfig(listing, hasConfirmedBooking)

        return (
          <Fragment key={listing.id}>
            {cfg.showCircle && (
              <Circle
                center={position}
                radius={cfg.radius}
                pathOptions={{
                  color: '#14b8a6',
                  fillColor: '#14b8a6',
                  fillOpacity: 0.15,
                  weight: 2,
                }}
              >
                <Popup autoPan={true} autoPanPadding={[80, 60]} className="map-listing-popup">
                  <ListingPopupCard
                    listing={listing}
                    language={language}
                    isApproximateLocation={cfg.isApproximatePopup}
                  />
                </Popup>
              </Circle>
            )}

            {!cfg.showCircle && cfg.icon && (
              <Marker position={position} icon={cfg.icon}>
                <Popup autoPan={true} autoPanPadding={[80, 60]} className="map-listing-popup">
                  <ListingPopupCard
                    listing={listing}
                    language={language}
                    isApproximateLocation={cfg.isApproximatePopup}
                  />
                </Popup>
              </Marker>
            )}
          </Fragment>
        )
      })}
    </MapContainer>
  )
}
