'use client'

/**
 * MapPicker - Interactive map for selecting listing location
 * Click to place marker, drag to adjust. Uses Leaflet (same as project).
 */

import React, { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const MapContainer = dynamic(
  () => import('react-leaflet').then(m => m.MapContainer),
  { ssr: false }
)
const TileLayer = dynamic(
  () => import('react-leaflet').then(m => m.TileLayer),
  { ssr: false }
)
const Marker = dynamic(
  () => import('react-leaflet').then(m => m.Marker),
  { ssr: false }
)

// Fix Leaflet default marker
if (typeof window !== 'undefined') {
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })
}

const PHUKET_CENTER = [7.8804, 98.3923]

function MapClickHandler({ onMapClick }) {
  const map = useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export default function MapPicker({ latitude, longitude, onSelect, height = 280 }) {
  const [mounted, setMounted] = useState(false)
  const [position, setPosition] = useState(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (latitude != null && longitude != null && !isNaN(latitude) && !isNaN(longitude)) {
      setPosition([latitude, longitude])
    } else {
      setPosition(null)
    }
  }, [latitude, longitude])

  const handleMapClick = (lat, lng) => {
    setPosition([lat, lng])
    onSelect?.(lat, lng)
  }

  if (!mounted) {
    return (
      <div
        className="w-full rounded-lg bg-slate-100 animate-pulse flex items-center justify-center"
        style={{ height }}
      >
        <span className="text-slate-400 text-sm">Loading map...</span>
      </div>
    )
  }

  const center = position || PHUKET_CENTER
  const zoom = position ? 15 : 12

  return (
    <div className="w-full rounded-lg overflow-hidden border border-slate-200" style={{ height }}>
      <MapContainer
        center={center}
        zoom={zoom}
        className="w-full h-full"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onMapClick={handleMapClick} />
        {position && <MapCenterUpdater center={position} zoom={15} />}
        {position && (
          <Marker
            position={position}
            draggable
            eventHandlers={{
              dragend(e) {
                const { lat, lng } = e.target.getLatLng()
                setPosition([lat, lng])
                onSelect?.(lat, lng)
              },
            }}
          />
        )}
      </MapContainer>
    </div>
  )
}
