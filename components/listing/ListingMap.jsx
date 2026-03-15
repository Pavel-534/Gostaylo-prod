'use client'

/**
 * ListingMap - Leaflet.js Map Integration (v4.2.1 - React 18 Compatible)
 * 
 * Features:
 * - OpenStreetMap base layer
 * - Hybrid display logic based on category:
 *   • Property, Nanny → Privacy Circle (500m radius), no exact marker
 *   • Transport, Yacht, Tour, Food → Exact Marker (pinpoint location)
 * - Fallback for missing coordinates
 * - Google Maps integration for exact categories
 * - Responsive design
 * 
 * @component
 */

import React, { useMemo } from 'react'
import dynamic from 'next/dynamic'
import { MapPin, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Dynamic import to avoid SSR issues with Leaflet (v4.2.1 compatible)
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

// Category mapping for display logic
const PRIVACY_CATEGORIES = ['1', 'nanny', 'property'] // Property, Nanny → Circle
const EXACT_CATEGORIES = ['2', '3', '4', 'vehicles', 'transport', 'yacht', 'yachts', 'tour', 'tours', 'food'] // Transport, Yacht, Tour, Food → Exact marker

export function ListingMap({ latitude, longitude, title, district, language = 'en', categoryId }) {
  // Check if coordinates are available
  const hasCoordinates = latitude && longitude && !isNaN(latitude) && !isNaN(longitude)

  // Determine display mode based on category
  const showPrivacyCircle = useMemo(() => {
    if (!categoryId) return true // Default to privacy mode
    return PRIVACY_CATEGORIES.includes(String(categoryId).toLowerCase())
  }, [categoryId])

  const showExactMarker = useMemo(() => {
    if (!categoryId) return false
    return EXACT_CATEGORIES.includes(String(categoryId).toLowerCase())
  }, [categoryId])

  // Memoize position to prevent re-renders
  const position = useMemo(() => {
    if (!hasCoordinates) return null
    return [parseFloat(latitude), parseFloat(longitude)]
  }, [latitude, longitude, hasCoordinates])

  // Google Maps URL
  const googleMapsUrl = useMemo(() => {
    if (!hasCoordinates) return null
    return `https://www.google.com/maps?q=${latitude},${longitude}`
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
    <div className="space-y-3">
      <div className="h-[400px] rounded-xl overflow-hidden border border-slate-200">
        <MapContainer
          center={position}
          zoom={showPrivacyCircle ? 13 : 15}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* Privacy Mode: Show Circle (Property, Nanny) */}
          {showPrivacyCircle && (
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
          )}
          
          {/* Exact Mode: Show Marker (Transport, Yacht, Tour, Food) */}
          {showExactMarker && (
            <Marker position={position}>
              <Popup>
                <div className="p-2">
                  <h4 className="font-semibold text-slate-900">{title}</h4>
                  {district && (
                    <p className="text-sm text-slate-600 mt-1">{district}</p>
                  )}
                  <p className="text-xs text-teal-600 mt-2 font-medium">
                    {language === 'ru' 
                      ? 'Точное местоположение' 
                      : 'Exact location'}
                  </p>
                </div>
              </Popup>
            </Marker>
          )}
          
          {/* Center marker for Privacy mode */}
          {showPrivacyCircle && (
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
          )}
        </MapContainer>
      </div>
      
      {/* Google Maps Button for Exact Categories */}
      {showExactMarker && googleMapsUrl && (
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => window.open(googleMapsUrl, '_blank')}
        >
          <ExternalLink className="h-4 w-4" />
          {language === 'ru' ? 'Открыть в Google Maps' : 'Open in Google Maps'}
        </Button>
      )}
    </div>
  )
}

// Add Leaflet CSS import helper
export function LeafletCSS() {
  return (
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossOrigin=""
    />
  )
}
