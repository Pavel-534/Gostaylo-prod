/**
 * GoStayLo - Interactive Search Map (Airbnb-style)
 * Desktop: list ~60% / map ~40%; price pills; viewport bounds sync.
 *
 * Приватность: getListingLocationDisplayMode — «примерная» зона без круга, пилюля с пунктиром / ~.
 */

'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CardPriceDisplay } from '@/components/card/CardPriceDisplay'
import { ListingCardSpecsRow } from '@/components/listing/ListingCardSpecsRow'
import { getUIText } from '@/lib/translations'
import { toPublicImageUrl } from '@/lib/public-image-url'
import { getListingLocationDisplayMode } from '@/lib/listing-location-privacy'
import { formatPrice } from '@/lib/currency'
import {
  extractListingLatLng,
  createLeafletPricePillDivIcon,
  leafletBoundsAroundPointMeters,
} from '@/lib/maps/map-provider-adapter'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function getListingPosition(listing) {
  const ll = extractListingLatLng(listing)
  return ll ? [ll.lat, ll.lng] : null
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
    return leafletBoundsAroundPointMeters(L, { lat: pos[0], lng: pos[1] }, 500)
  }
  return L.latLngBounds(pos, pos)
}

function MapSearchThisAreaButton({
  language,
  listingsLength,
  suppressBoundsUntilRef,
  appliedBboxKey,
  onSearchThisArea,
  mapBoundsLocked,
  onClearMapBounds,
}) {
  const map = useMap()
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setDirty(false)
  }, [appliedBboxKey])

  useMapEvents({
    moveend: () => {
      if (!listingsLength) return
      if (!onSearchThisArea && !mapBoundsLocked) return
      if (Date.now() < suppressBoundsUntilRef.current) return
      setDirty(true)
    },
  })

  const applyViewportBounds = () => {
    if (!onSearchThisArea) return
    const b = map.getBounds()
    onSearchThisArea({
      south: b.getSouth(),
      west: b.getWest(),
      north: b.getNorth(),
      east: b.getEast(),
    })
    setDirty(false)
  }

  const canNarrow = listingsLength > 0 && onSearchThisArea
  const showSearchThisArea = !mapBoundsLocked && dirty && canNarrow
  const showSearchEverywhere = mapBoundsLocked && typeof onClearMapBounds === 'function'
  const showUpdateArea = mapBoundsLocked && dirty && canNarrow

  if (!showSearchThisArea && !showSearchEverywhere && !showUpdateArea) return null

  return (
    <div className="pointer-events-auto absolute left-1/2 top-3 z-[400] flex w-[92%] max-w-md -translate-x-1/2 flex-col items-center gap-2 px-1">
      {showSearchEverywhere && (
        <Button
          type="button"
          className="h-10 w-full max-w-sm rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 shadow-lg hover:bg-slate-50"
          onClick={() => {
            onClearMapBounds()
            setDirty(false)
          }}
        >
          {getUIText('mapSearch_everywhere', language)}
        </Button>
      )}
      {showUpdateArea && (
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full max-w-sm rounded-full border-slate-200 bg-white/95 px-5 text-sm font-semibold text-slate-800 shadow-md hover:bg-slate-50"
          onClick={applyViewportBounds}
        >
          {getUIText('mapSearch_updateArea', language)}
        </Button>
      )}
      {showSearchThisArea && (
        <Button
          type="button"
          className="h-10 w-full max-w-sm rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 shadow-lg hover:bg-slate-50"
          onClick={applyViewportBounds}
        >
          {getUIText('mapSearch_thisArea', language)}
        </Button>
      )}
    </div>
  )
}

function InitialListingBoundsFit({
  listings,
  hasConfirmedBookingFn,
  suppressBoundsUntilRef,
  mapFitResetKey,
}) {
  const map = useMap()
  const didFitRef = useRef(false)
  const lastResetKeyRef = useRef(mapFitResetKey)

  useEffect(() => {
    if (lastResetKeyRef.current !== mapFitResetKey) {
      lastResetKeyRef.current = mapFitResetKey
      didFitRef.current = false
    }
  }, [mapFitResetKey])

  useEffect(() => {
    if (!listings?.length || didFitRef.current) return
    let bounds = null
    for (const listing of listings) {
      const b = listingLocationBounds(listing, hasConfirmedBookingFn)
      if (!b || !b.isValid()) continue
      bounds = bounds ? bounds.extend(b) : b
    }
    if (bounds?.isValid()) {
      suppressBoundsUntilRef.current = Date.now() + 1400
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 })
      didFitRef.current = true
    }
  }, [listings, map, hasConfirmedBookingFn, suppressBoundsUntilRef, mapFitResetKey])

  return null
}

function ListingPopupCard({
  listing,
  language = 'ru',
  isApproximateLocation,
  initialDates = null,
  currency = 'THB',
  exchangeRates = { THB: 1 },
}) {
  const raw = listing.images?.[0] || listing.coverImage || '/placeholder.svg'
  const image = raw ? toPublicImageUrl(raw) || raw : raw
  const rating = parseFloat(listing.rating || listing.avgRating || listing.average_rating || 0) || 0
  const reviewsCt = listing.reviewsCount ?? listing.reviews_count ?? 0
  const locHint = getUIText(
    isApproximateLocation ? 'mapListing_approximatePopup' : 'mapListing_exactPopup',
    language,
  )
  const basePrice = parseFloat(listing.basePriceThb ?? listing.base_price_thb ?? 0) || 0
  const categorySlug =
    listing.categorySlug || listing.category?.slug || listing.metadata?.category_slug || ''

  return (
    <div className="w-64">
      <img src={image} alt={listing.title} className="h-32 w-full rounded-t-lg object-cover" />
      <div className="rounded-b-lg bg-white p-3">
        <h3 className="mb-1 truncate text-sm font-semibold text-slate-900">{listing.title}</h3>
        <div className="mb-2 flex items-center gap-1">
          {rating > 0 ? (
            <>
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <span className="text-xs font-medium text-slate-700">{rating.toFixed(1)}</span>
              {reviewsCt > 0 && <span className="text-xs text-slate-500">({reviewsCt})</span>}
            </>
          ) : (
            <span className="text-xs text-slate-400">{getUIText('newListing', language)}</span>
          )}
        </div>
        <p className="mb-2 text-[11px] leading-snug text-slate-500">{locHint}</p>
        <ListingCardSpecsRow listing={listing} language={language} compact className="mb-2" />
        <div className="flex items-baseline justify-between gap-1 border-t border-slate-100 pt-2">
          <CardPriceDisplay
            basePrice={basePrice}
            pricing={listing.pricing}
            initialDates={initialDates || {}}
            currency={currency}
            exchangeRates={exchangeRates}
            language={language}
            categorySlug={categorySlug}
          />
        </div>
        <a
          href={`/listings/${listing.id}`}
          className="mt-2 block w-full rounded-lg bg-teal-600 px-3 py-1.5 text-center text-xs font-medium text-white transition-colors hover:bg-teal-700"
        >
          {getUIText('viewDetails', language)}
        </a>
      </div>
    </div>
  )
}

function ListingPriceMarker({
  listing,
  position,
  priceLabel,
  approximate,
  selected,
  language,
  onSelect,
  initialDates,
  currency,
  exchangeRates,
}) {
  const map = useMap()
  const icon = useMemo(
    () => createLeafletPricePillDivIcon(L, priceLabel, { selected, approximate }),
    [priceLabel, selected, approximate]
  )

  return (
    <Marker
      position={position}
      icon={icon}
      eventHandlers={{
        click: () => {
          onSelect?.(listing.id)
          map.setView(position, Math.max(map.getZoom(), 14), { animate: true })
        },
      }}
    >
      <Popup autoPan={true} autoPanPadding={[80, 60]} className="map-listing-popup">
        <ListingPopupCard
          listing={listing}
          language={language}
          isApproximateLocation={approximate}
          initialDates={initialDates}
          currency={currency}
          exchangeRates={exchangeRates}
        />
      </Popup>
    </Marker>
  )
}

function markerVisualFlags(listing, hasConfirmedBookingFn) {
  if (hasConfirmedBookingFn(listing.id)) {
    return { approximate: false }
  }
  const mode = getListingLocationDisplayMode({
    categorySlug: listingCategorySlug(listing),
    categoryId: listing.category_id ?? listing.categoryId,
  })
  return { approximate: mode === 'privacy' }
}

export default function InteractiveSearchMap({
  listings = [],
  userBookings = [],
  userId = null,
  language = 'ru',
  center = [7.8804, 98.3923],
  zoom = 12,
  currency = 'THB',
  exchangeRates = { THB: 1 },
  /** Синхрон с карточками списка: даты для `CardPriceDisplay` во всплывающем окне маркера */
  initialDates = null,
  selectedListingId = null,
  onListingMarkerClick,
  onSearchThisArea,
  mapBoundsLocked = false,
  onClearMapBounds,
  appliedBboxKey = '',
  mapFitResetKey = '',
}) {
  const [mounted, setMounted] = useState(false)
  const suppressBoundsUntilRef = useRef(0)

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

  const priceForMarker = useCallback(
    (listing) => {
      const thb = parseFloat(listing.basePriceThb ?? listing.base_price_thb ?? 0) || 0
      return formatPrice(thb, currency, exchangeRates, language)
    },
    [currency, exchangeRates, language]
  )

  if (!mounted) {
    return (
      <div className="w-full h-full bg-slate-100 animate-pulse rounded-lg flex items-center justify-center">
        <span className="text-slate-400">{getUIText('mapPicker_loading', language)}</span>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full min-h-[300px]">
      <MapContainer
        center={center}
        zoom={zoom}
        className="absolute inset-0 z-0 h-full w-full rounded-lg"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapSearchThisAreaButton
          language={language}
          listingsLength={listings?.length ?? 0}
          suppressBoundsUntilRef={suppressBoundsUntilRef}
          appliedBboxKey={appliedBboxKey}
          onSearchThisArea={onSearchThisArea}
          mapBoundsLocked={mapBoundsLocked}
          onClearMapBounds={onClearMapBounds}
        />
        <InitialListingBoundsFit
        listings={listings}
        hasConfirmedBookingFn={hasConfirmedBooking}
        suppressBoundsUntilRef={suppressBoundsUntilRef}
        mapFitResetKey={mapFitResetKey}
      />

      {listings.map((listing) => {
        const position = getListingPosition(listing)
        if (!position) return null
        const { approximate } = markerVisualFlags(listing, hasConfirmedBooking)
        const priceText = (approximate ? '~' : '') + priceForMarker(listing)

        return (
          <ListingPriceMarker
            key={listing.id}
            listing={listing}
            position={position}
            priceLabel={priceText}
            approximate={approximate}
            selected={selectedListingId === listing.id}
            language={language}
            onSelect={onListingMarkerClick}
            initialDates={initialDates}
            currency={currency}
            exchangeRates={exchangeRates}
          />
        )
      })}
      </MapContainer>
    </div>
  )
}
