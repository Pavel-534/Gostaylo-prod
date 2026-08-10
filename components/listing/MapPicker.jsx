'use client'

/**
 * MapPicker — точка на карте для объявления (партнёр).
 * Stage 200.31 — pan/zoom vs pin-lock split + live Leaflet gesture sync.
 * i18n: getUIText + language; приватность: lib/listing-location-privacy.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useMapEvents, useMap } from 'react-leaflet'
import { fetchReverseGeocode } from '@/lib/api/geocode-client'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Button } from '@/components/ui/button'
import { Lock, Unlock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUIText } from '@/lib/translations'
import { isPrivacyLocationMode } from '@/lib/listing-location-privacy'
import { configureLeafletDefaultIcons } from '@/lib/maps/leaflet-default-icon'
import { MapGestureSync } from '@/components/listing/MapGestureSync'

const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then((m) => m.Marker), { ssr: false })
const Tooltip = dynamic(() => import('react-leaflet').then((m) => m.Tooltip), { ssr: false })

if (typeof window !== 'undefined') {
  configureLeafletDefaultIcons(L)
}

/** Stage 200.36 — world default; wizard passes geo_locations centroid via mapCenter. No Moscow/hub coerce. */
const WORLD_DEFAULT_CENTER = [20, 100]

function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const mq = window.matchMedia('(pointer: coarse)')
    const apply = () => setCoarse(Boolean(mq.matches))
    apply()
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
    mq.addListener?.(apply)
    return () => mq.removeListener?.(apply)
  }, [])
  return coarse
}

function MapClickHandler({ onMapClick, enabled }) {
  useMapEvents({
    click(e) {
      if (enabled) onMapClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

/** Follow pin only when coordinates actually change — do not fight user pan/zoom. */
function MapCenterUpdater({ center, zoom }) {
  const map = useMap()
  const lastKeyRef = useRef('')
  useEffect(() => {
    if (!center || !Array.isArray(center) || center.length < 2) return
    const lat = Number(center[0])
    const lng = Number(center[1])
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    const z = zoom ?? map.getZoom()
    const key = `${lat.toFixed(5)},${lng.toFixed(5)},${z}`
    if (lastKeyRef.current === key) return
    lastKeyRef.current = key
    map.setView([lat, lng], z)
  }, [center, zoom, map])
  return null
}

function normalizeGeocodeForForm(data, privacyMode) {
  if (!data || typeof data !== 'object') return null
  const district = data.district || ''
  const city = data.city || ''
  const displayName = data.displayName || ''
  const country = data.country || ''
  const countryCode = data.countryCode || data.address?.country_code || null
  const state = data.state || data.address?.state || null
  const address = data.address && typeof data.address === 'object' ? data.address : null
  const extras = {
    regionCode: data.regionCode || null,
    regionLabel: data.regionLabel || null,
    cityCode: data.cityCode || null,
    timezone: data.timezone || null,
    currencyCode: data.currencyCode || null,
    geoSource: data.geoSource || null,
    streetAddress: data.streetAddress || null,
    lang: data.lang || null,
  }
  // Keep district as suburb/neighbourhood only — never join city into district.
  const districtClean =
    district || (privacyMode ? displayName.split(',')[0]?.trim() || '' : '')
  return {
    district: districtClean,
    city,
    displayName:
      displayName || [district, city].filter(Boolean).join(', ') || '',
    country,
    countryCode: countryCode
      ? String(countryCode).trim().toUpperCase().slice(0, 2)
      : null,
    state,
    address,
    ...extras,
  }
}

/**
 * @param {{
 *   latitude?: number|null
 *   longitude?: number|null
 *   onSelect?: (lat: number, lng: number, geo?: object|null) => void
 *   height?: number|string
 *   mapClassName?: string
 *   fetchAddressOnClick?: boolean
 *   categoryId?: string|null
 *   categorySlug?: string|null
 *   lockable?: boolean
 *   language?: string
 *   cooperativeTouch?: boolean | 'auto'
 *   countryCode?: string|null
 *   mapCenter?: [number, number]|null
 *   partnerPlaceHints?: boolean — partner wizard: exact place-pin copy (not guest privacy)
 * }} props
 */
export default function MapPicker({
  latitude,
  longitude,
  onSelect,
  height = 320,
  mapClassName = '',
  fetchAddressOnClick = true,
  categoryId = null,
  categorySlug = null,
  lockable = true,
  language = 'ru',
  /** Mobile scrollport: require tap before map captures touch. `auto` = coarse pointers only. */
  cooperativeTouch = 'auto',
  /** ISO country for empty-pin default viewport (wizard). */
  countryCode = null,
  /** Optional [lat,lng] override from geo_locations.centroid (Stage 200.36). */
  mapCenter = null,
  partnerPlaceHints = false,
}) {
  const t = (key) => getUIText(key, language)
  const coarsePointer = useCoarsePointer()
  const coopEnabled =
    cooperativeTouch === true || (cooperativeTouch === 'auto' && coarsePointer)

  const [mounted, setMounted] = useState(false)
  const [position, setPosition] = useState(null)
  const [mapGestureActive, setMapGestureActive] = useState(() => !coopEnabled)
  const privacyMode = isPrivacyLocationMode({ categorySlug, categoryId })
  /** Partner wizard: always show exact place-pin copy (guest privacy stays on storefront). */
  const placeHintPrivacy = partnerPlaceHints ? false : privacyMode

  const hasInitialPin =
    latitude != null && longitude != null && !isNaN(Number(latitude)) && !isNaN(Number(longitude))

  const [unlocked, setUnlocked] = useState(true)
  const hadPinRef = useRef(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!coopEnabled) setMapGestureActive(true)
  }, [coopEnabled])

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
          const { ok, data } = await fetchReverseGeocode(lat, lng, { lang: language })
          if (ok && data) geo = normalizeGeocodeForForm(data, privacyMode)
        } catch (e) {
          console.warn('[MapPicker] Reverse geocode failed:', e)
        }
      }
      onSelect?.(lat, lng, geo)
    },
    [fetchAddressOnClick, onSelect, privacyMode, language],
  )

  const handleMapClick = (lat, lng) => {
    void applySelection(lat, lng)
  }

  const handleUnlockToggle = () => {
    setUnlocked((u) => {
      const next = !u
      if (next) setMapGestureActive(true)
      return next
    })
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

  const center =
    position ||
    (Array.isArray(mapCenter) && mapCenter.length >= 2 ? mapCenter : null) ||
    WORLD_DEFAULT_CENTER
  const zoom = position ? 15 : 12
  /** Pin edit (click / drag marker) — separate from view pan/zoom. */
  const pinEditEnabled = lockable ? unlocked : true
  const lockedVisual = lockable && !unlocked && !!position
  /** View: pan + pinch + wheel — never gated by pin lock (Airbnb-like). */
  const viewGesturesEnabled = coopEnabled ? mapGestureActive : true

  return (
    <div className="space-y-2">
      {lockable && position ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={unlocked ? 'brand' : 'outline'}
            size="sm"
            className={cn(
              'min-h-[44px] gap-1.5',
              !unlocked && 'border-slate-300',
            )}
            onClick={handleUnlockToggle}
          >
            {unlocked ? (
              <>
                <Lock className="h-4 w-4" />
                {t('mapPicker_lockPosition')}
              </>
            ) : (
              <>
                <Unlock className="h-4 w-4 text-brand-hover" aria-hidden />
                {t('mapPicker_editLocation')}
              </>
            )}
          </Button>
          <p className="text-xs text-slate-500">
            {unlocked
              ? placeHintPrivacy
                ? t('mapPicker_hintUnlockPrivacy')
                : t('mapPicker_hintUnlockExact')
              : t('mapPicker_hintLocked')}
          </p>
        </div>
      ) : lockable && !position ? (
        <p className="text-xs text-slate-600" data-testid="map-picker-place-hint">
          {placeHintPrivacy ? t('mapPicker_hintPlacePrivacy') : t('mapPicker_hintPlaceExact')}
        </p>
      ) : null}

      <div
        className={cn(
          'relative z-0 isolate w-full overflow-hidden rounded-lg border border-slate-200',
          coopEnabled && !mapGestureActive && 'touch-pan-y',
          mapClassName,
        )}
        style={mapHeightStyle}
      >
        {coopEnabled && !mapGestureActive ? (
          <button
            type="button"
            className="absolute inset-0 z-[500] flex items-center justify-center bg-slate-900/[0.03] px-3"
            onClick={() => setMapGestureActive(true)}
            aria-label={t('mapPicker_cooperativeTap')}
          >
            <span className="pointer-events-none max-w-[min(100%,18rem)] rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-center text-xs font-medium text-slate-600 shadow-sm">
              {t('mapPicker_cooperativeTap')}
            </span>
          </button>
        ) : null}
        <MapContainer
          center={center}
          zoom={zoom}
          className="h-full w-full"
          scrollWheelZoom={viewGesturesEnabled}
          dragging={viewGesturesEnabled}
          touchZoom={viewGesturesEnabled}
          doubleClickZoom={viewGesturesEnabled}
          // Prefer continuous pinch (Leaflet); buttons remain as fallback.
          zoomControl
        >
          <MapGestureSync enabled={viewGesturesEnabled} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onMapClick={handleMapClick} enabled={pinEditEnabled} />
          <MapCenterUpdater center={center} zoom={zoom} />
          {position && (
            <Marker
              position={position}
              draggable={pinEditEnabled}
              eventHandlers={{
                dragend(e) {
                  if (!pinEditEnabled) return
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
