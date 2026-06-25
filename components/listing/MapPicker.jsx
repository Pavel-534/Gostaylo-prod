'use client'

/**
 * MapPicker — точка на карте для объявления (партнёр).
 * i18n: getUIText + language; приватность: lib/listing-location-privacy.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useMapEvents, useMap } from 'react-leaflet'
import { fetchReverseGeocode } from '@/lib/api/geocode-client'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Button } from '@/components/ui/button'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUIText } from '@/lib/translations'
import { isPrivacyLocationMode } from '@/lib/listing-location-privacy'
import { configureLeafletDefaultIcons } from '@/lib/maps/leaflet-default-icon'

const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then((m) => m.Marker), { ssr: false })
const Tooltip = dynamic(() => import('react-leaflet').then((m) => m.Tooltip), { ssr: false })

if (typeof window !== 'undefined') {
  configureLeafletDefaultIcons(L)
}

const PHUKET_CENTER = [7.8804, 98.3923]

function MapClickHandler({ onMapClick, enabled }) {
  useMapEvents({
    click(e) {
      if (enabled) onMapClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function MapCenterUpdater({ center, zoom }) {
  const map = useMap()
  useEffect(() => {
    if (center && Array.isArray(center) && center.length >= 2) {
      map.setView(center, zoom ?? 15)
    }
  }, [center, zoom, map])
  return null
}

function normalizeGeocodeForForm(data, privacyMode) {
  if (!data || typeof data !== 'object') return null
  const district = data.district || ''
  const city = data.city || ''
  const displayName = data.displayName || ''
  if (privacyMode) {
    return {
      district: district || displayName.split(',')[0]?.trim() || '',
      city,
      displayName,
    }
  }
  const precise =
    [district, city].filter(Boolean).join(', ') ||
    displayName.split(',').slice(0, 3).join(',').trim() ||
    displayName
  return { district: precise, city, displayName }
}

export default function MapPicker({
  latitude,
  longitude,
  onSelect,
  height = 280,
  mapClassName = '',
  fetchAddressOnClick = true,
  categoryId = null,
  categorySlug = null,
  lockable = true,
  language = 'ru',
  /** Mobile scrollport: require tap before map captures touch (Leaflet cooperative gesture). */
  cooperativeTouch = false,
}) {
  const t = (key) => getUIText(key, language)
  const [mounted, setMounted] = useState(false)
  const [position, setPosition] = useState(null)
  const [mapGestureActive, setMapGestureActive] = useState(!cooperativeTouch)
  const privacyMode = isPrivacyLocationMode({ categorySlug, categoryId })

  const hasInitialPin =
    latitude != null && longitude != null && !isNaN(Number(latitude)) && !isNaN(Number(longitude))

  const [unlocked, setUnlocked] = useState(true)
  const hadPinRef = useRef(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!cooperativeTouch) setMapGestureActive(true)
  }, [cooperativeTouch])

  useEffect(() => {
    if (hasInitialPin) {
      setPosition([Number(latitude), Number(longitude)])
    } else {
      setPosition(null)
      setUnlocked(true)
      hadPinRef.current = false
    }
  }, [latitude, longitude, hasInitialPin])

  useEffect(() => {
    if (hasInitialPin && !hadPinRef.current) {
      setUnlocked(false)
      hadPinRef.current = true
    }
  }, [hasInitialPin])

  const applySelection = useCallback(
    async (lat, lng) => {
      setPosition([lat, lng])
      let geo = null
      if (fetchAddressOnClick) {
        try {
          const { ok, data } = await fetchReverseGeocode(lat, lng)
          if (ok && data) geo = normalizeGeocodeForForm(data, privacyMode)
        } catch (e) {
          console.warn('[MapPicker] Reverse geocode failed:', e)
        }
      }
      onSelect?.(lat, lng, geo)
    },
    [fetchAddressOnClick, onSelect, privacyMode]
  )

  const handleMapClick = (lat, lng) => {
    void applySelection(lat, lng)
  }

  const mapHeightStyle = typeof height === 'number' ? { height } : { height: height || '100%' }

  if (!mounted) {
    return (
      <div
        className={cn(
          'flex w-full animate-pulse items-center justify-center rounded-lg bg-slate-100',
          mapClassName,
        )}
        style={mapHeightStyle}
      >
        <span className="text-sm text-slate-400">{t('mapPicker_loading')}</span>
      </div>
    )
  }

  const center = position || PHUKET_CENTER
  const zoom = position ? 15 : 12
  const markerDraggable = lockable ? unlocked : true
  const mapClicksEnabled = lockable ? unlocked : true
  const lockedVisual = lockable && !unlocked && !!position
  const mapGesturesEnabled = cooperativeTouch ? mapGestureActive : true

  return (
    <div className="space-y-2">
      {lockable ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={unlocked ? 'default' : 'outline'}
            size="sm"
            className={unlocked ? 'bg-brand hover:bg-brand-hover' : 'border-slate-300'}
            onClick={() => setUnlocked((u) => !u)}
          >
            {unlocked ? (
              <>
                <Lock className="mr-1.5 h-4 w-4" />
                {t('mapPicker_lockPosition')}
              </>
            ) : (
              <>
                <Lock className="mr-1.5 h-4 w-4 text-brand-hover" aria-hidden />
                {t('mapPicker_editLocation')}
              </>
            )}
          </Button>
          <p className="text-xs text-slate-500">
            {unlocked
              ? privacyMode
                ? t('mapPicker_hintUnlockPrivacy')
                : t('mapPicker_hintUnlockExact')
              : t('mapPicker_hintLocked')}
          </p>
        </div>
      ) : null}

      <div
        className={cn(
          'relative w-full overflow-hidden rounded-lg border border-slate-200',
          cooperativeTouch && !mapGestureActive && 'touch-pan-y',
          mapClassName,
        )}
        style={mapHeightStyle}
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
          center={center}
          zoom={zoom}
          className="h-full w-full"
          scrollWheelZoom={mapGesturesEnabled}
          dragging={mapGesturesEnabled && mapClicksEnabled}
          touchZoom={mapGesturesEnabled}
          doubleClickZoom={mapGesturesEnabled}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onMapClick={handleMapClick} enabled={mapClicksEnabled} />
          {position && <MapCenterUpdater center={position} zoom={15} />}
          {position && (
            <Marker
              position={position}
              draggable={markerDraggable}
              eventHandlers={{
                dragend(e) {
                  if (!markerDraggable) return
                  const { lat, lng } = e.target.getLatLng()
                  void applySelection(lat, lng)
                },
              }}
            >
              {lockedVisual ? (
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -36]}
                  opacity={1}
                  className="!rounded-full !border !border-slate-200 !bg-white/95 !px-2 !py-1 !text-base !shadow-md"
                >
                  <span role="img" aria-label={t('mapPicker_lockedMarkerAria')}>
                    🔒
                  </span>
                </Tooltip>
              ) : null}
            </Marker>
          )}
        </MapContainer>
      </div>
    </div>
  )
}
