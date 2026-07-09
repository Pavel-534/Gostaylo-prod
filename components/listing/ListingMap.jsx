'use client'

/**
 * ListingMap — публичная карта объекта (круг 500 м или точный маркер по slug).
 * CSS Leaflet только здесь (не в `app/layout.js`) — уменьшает глобальный бандл.
 */
import 'leaflet/dist/leaflet.css'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { MapPin, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'
import { ListingCardSpecsRow } from '@/components/listing/ListingCardSpecsRow'
import { getListingLocationDisplayMode } from '@/lib/listing-location-privacy'
import { cn } from '@/lib/utils'

const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
)

const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false })

const Circle = dynamic(() => import('react-leaflet').then((mod) => mod.Circle), { ssr: false })

const ListingMapPin = dynamic(
  () => import('@/components/listing/ListingMapPin').then((mod) => mod.ListingMapPin),
  { ssr: false },
)

const Popup = dynamic(() => import('react-leaflet').then((mod) => mod.Popup), { ssr: false })

export function ListingMap({
  latitude,
  longitude,
  title,
  district,
  language = 'en',
  categoryId,
  categorySlug,
  /** Полный объект листинга — спеки строкой как на карточках каталога (Stage 86.0) */
  listing = null,
  /** PDP: tap overlay before map captures touch (scrollport-safe). */
  cooperativeTouch = false,
}) {
  const t = (key) => getUIText(key, language)
  const [mapGestureActive, setMapGestureActive] = useState(!cooperativeTouch)
  const hasCoordinates = latitude && longitude && !isNaN(latitude) && !isNaN(longitude)

  const mode = useMemo(
    () => getListingLocationDisplayMode({ categorySlug, categoryId }),
    [categorySlug, categoryId]
  )
  const showPrivacyCircle = mode === 'privacy'
  const showExactMarker = mode === 'exact'

  const position = useMemo(() => {
    if (!hasCoordinates) return null
    return [parseFloat(latitude), parseFloat(longitude)]
  }, [latitude, longitude, hasCoordinates])

  const googleMapsUrl = useMemo(() => {
    if (!hasCoordinates) return null
    return `https://www.google.com/maps?q=${latitude},${longitude}`
  }, [latitude, longitude, hasCoordinates])

  const mapGesturesEnabled = cooperativeTouch ? mapGestureActive : true

  if (!hasCoordinates) {
    return (
      <div className="h-[400px] bg-slate-100 rounded-xl flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300">
        <MapPin className="h-16 w-16 text-slate-400 mb-4" />
        <h3 className="text-lg font-semibold text-slate-700 mb-2">{t('mapListing_exactHiddenTitle')}</h3>
        <p className="text-sm text-slate-500 text-center max-w-md">{t('mapListing_exactHiddenBody')}</p>
        {district && (
          <div className="mt-4 px-4 py-2 bg-brand/10 border border-brand/25 rounded-lg">
            <p className="text-sm font-medium text-brand-hover">
              {t('mapListing_districtPrefix')} {district}
            </p>
          </div>
        )}
      </div>
    )
  }

  const listingForSpecs =
    listing ||
    {
      latitude,
      longitude,
      district,
      title,
      categories: categorySlug ? { slug: categorySlug } : undefined,
      categorySlug,
      metadata: {},
    }

  return (
    <div className="space-y-3">
      <ListingCardSpecsRow listing={listingForSpecs} language={language} compact />
      <div
        className={cn(
          'relative h-[min(280px,50vw)] max-h-[400px] min-h-[220px] rounded-xl overflow-hidden border border-slate-200 sm:h-[400px]',
          cooperativeTouch && !mapGestureActive && 'touch-pan-y',
        )}
      >
        {cooperativeTouch && !mapGestureActive ? (
          <button
            type="button"
            className="absolute inset-0 z-[1000] flex items-end justify-center bg-slate-900/[0.03] pb-3"
            onClick={() => setMapGestureActive(true)}
            aria-label={t('mapPicker_cooperativeTap')}
          >
            <span className="rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
              {t('mapPicker_cooperativeTap')}
            </span>
          </button>
        ) : null}
        <MapContainer
          center={position}
          zoom={showPrivacyCircle ? 13 : 15}
          scrollWheelZoom={mapGesturesEnabled}
          dragging={mapGesturesEnabled}
          touchZoom={mapGesturesEnabled}
          doubleClickZoom={mapGesturesEnabled}
          style={{ height: '100%', width: '100%' }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {showPrivacyCircle && (
            <Circle
              center={position}
              radius={500}
              pathOptions={{
                color: '#0d9488',
                fillColor: '#14b8a6',
                fillOpacity: 0.2,
                weight: 2,
              }}
            />
          )}

          {showExactMarker && (
            <ListingMapPin position={position}>
              <Popup autoPan={false}>
                <div className="p-2">
                  <h4 className="font-semibold text-slate-900">{title}</h4>
                  {district && <p className="text-sm text-slate-600 mt-1">{district}</p>}
                  <p className="text-xs text-brand mt-2 font-medium">{t('mapListing_exactPopup')}</p>
                </div>
              </Popup>
            </ListingMapPin>
          )}

          {showPrivacyCircle && (
            <ListingMapPin position={position} approximate>
              <Popup autoPan={false}>
                <div className="p-2">
                  <h4 className="font-semibold text-slate-900">{title}</h4>
                  {district && <p className="text-sm text-slate-600 mt-1">{district}</p>}
                  <p className="text-xs text-slate-500 mt-2">{t('mapListing_approximatePopup')}</p>
                </div>
              </Popup>
            </ListingMapPin>
          )}
        </MapContainer>
      </div>

      {showExactMarker && googleMapsUrl && (
        <Button variant="outline" className="w-full gap-2" onClick={() => window.open(googleMapsUrl, '_blank')}>
          <ExternalLink className="h-4 w-4" />
          {t('mapListing_openGoogleMaps')}
        </Button>
      )}
    </div>
  )
}
