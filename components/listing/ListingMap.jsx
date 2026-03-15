'use client'

/**
 * ListingMap - Leaflet.js Map Integration
 * 
 * Features:
 * - OpenStreetMap base layer
 * - Circle marker for approximate location (privacy)
 * - Fallback for missing coordinates
 * - Responsive design
 * 
 * @component
 */

import React, { useMemo } from 'react'
import dynamic from 'next/dynamic'
import { MapPin } from 'lucide-react'

// Dynamic import to avoid SSR issues with Leaflet
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
)

const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
)

const Circle = dynamic(
  () => import('react-leaflet').then((mod) => mod.Circle),
  { ssr: false }
)

const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
)

const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
)

export function ListingMap({ latitude, longitude, title, district, language = 'en' }) {
  // Check if coordinates are available
  const hasCoordinates = latitude && longitude && !isNaN(latitude) && !isNaN(longitude)

  // Memoize position to prevent re-renders
  const position = useMemo(() => {
    if (!hasCoordinates) return null
    return [parseFloat(latitude), parseFloat(longitude)]
  }, [latitude, longitude, hasCoordinates])

  // Fallback UI when coordinates are missing
  if (!hasCoordinates) {
    return (
      <div className="h-[400px] bg-slate-100 rounded-xl flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300">
        <MapPin className="h-16 w-16 text-slate-400 mb-4" />
        <h3 className="text-lg font-semibold text-slate-700 mb-2">
          {language === 'ru' ? 'Точное местоположение скрыто' : 'Exact location hidden'}
        </h3>
        <p className="text-sm text-slate-500 text-center max-w-md">
          {language === 'ru' 
            ? 'Для защиты конфиденциальности, точный адрес будет предоставлен после бронирования.' 
            : 'For privacy, the exact address will be provided after booking.'}
        </p>
        {district && (
          <div className="mt-4 px-4 py-2 bg-teal-50 border border-teal-200 rounded-lg">
            <p className="text-sm font-medium text-teal-800">
              {language === 'ru' ? 'Район: ' : 'District: '}{district}
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-[400px] rounded-xl overflow-hidden border border-slate-200">
      <MapContainer
        center={position}
        zoom={14}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Approximate location circle (privacy-friendly) */}
        <Circle
          center={position}
          radius={500} // 500m radius for privacy
          pathOptions={{
            color: '#0d9488',
            fillColor: '#14b8a6',
            fillOpacity: 0.2,
            weight: 2
          }}
        />
        
        {/* Center marker */}
        <Marker position={position}>
          <Popup>
            <div className="p-2">
              <h4 className="font-semibold text-slate-900">{title}</h4>
              {district && (
                <p className="text-sm text-slate-600 mt-1">{district}</p>
              )}
              <p className="text-xs text-slate-500 mt-2">
                {language === 'ru' 
                  ? 'Приблизительное местоположение' 
                  : 'Approximate location'}
              </p>
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  )
}

// Add Leaflet CSS import helper
export function LeafletCSS() {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
        crossOrigin=""
      />
    </>
  )
}
