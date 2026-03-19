/**
 * Gostaylo - Interactive Search Map (Airbnb-style)
 * Desktop: 50/50 split (List Left, Map Right)
 * Mobile: Toggle between List and Map
 * 
 * Privacy Logic:
 * - Property/Nanny: 500m Circle
 * - Others: Precise Marker
 * 
 * Post-Booking Logic:
 * - CONFIRMED/PAID: Precise Marker (even for Property)
 */

'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Star } from 'lucide-react';
import { getUIText } from '@/lib/translations';

// Fix Leaflet default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom marker icons - popup opens BELOW marker to avoid being cut off by header
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
    popupAnchor: [0, 32] // Popup opens below marker to avoid header overlap
  });
};

// Normalize coordinates - support both latitude/longitude and lat/lng
function getListingPosition(listing) {
  const lat = listing.latitude ?? listing.lat;
  const lng = listing.longitude ?? listing.lng;
  if (lat != null && lng != null) {
    return [parseFloat(lat), parseFloat(lng)];
  }
  return null;
}

// Map bounds updater component
function MapBoundsUpdater({ listings }) {
  const map = useMap();
  
  useEffect(() => {
    if (listings && listings.length > 0) {
      const bounds = listings
        .map(l => getListingPosition(l))
        .filter(Boolean);
      
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
      }
    }
  }, [listings, map]);
  
  return null;
}

// Popup Card Component
function ListingPopupCard({ listing, language = 'ru' }) {
  const image = listing.images?.[0] || listing.coverImage || '/placeholder-listing.jpg';
  const price = listing.basePriceThb || listing.base_price_thb || 0;
  const rating = listing.rating || 0;
  
  return (
    <div className="w-64">
      <img 
        src={image} 
        alt={listing.title}
        className="w-full h-32 object-cover rounded-t-lg"
      />
      <div className="p-3 bg-white rounded-b-lg">
        <h3 className="font-semibold text-sm text-slate-900 truncate mb-1">
          {listing.title}
        </h3>
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
  );
}

export default function InteractiveSearchMap({ 
  listings = [], 
  userBookings = [], 
  userId = null,
  language = 'ru',
  center = [7.8804, 98.3923], // Default: Phuket
  zoom = 12 
}) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!mounted) {
    return (
      <div className="w-full h-full bg-slate-100 animate-pulse rounded-lg flex items-center justify-center">
        <span className="text-slate-400">Loading map...</span>
      </div>
    );
  }
  
  // Check if user has confirmed/paid booking for a listing
  const hasConfirmedBooking = (listingId) => {
    if (!userId || !userBookings || userBookings.length === 0) return false;
    
    return userBookings.some(booking => 
      booking.listing_id === listingId && 
      (booking.status === 'CONFIRMED' || booking.status === 'PAID')
    );
  };
  
  // Determine marker type based on category and booking status
  const getMarkerConfig = (listing) => {
    const categoryId = listing.category_id || listing.categoryId;
    const listingId = listing.id;
    
    // Privacy categories (show circle)
    const privacyCategories = [1, 2]; // Property, Nanny
    const isPrivacyCategory = privacyCategories.includes(categoryId);
    
    // If user has confirmed booking, always show precise marker
    if (hasConfirmedBooking(listingId)) {
      return {
        type: 'marker',
        icon: createCustomIcon('orange'), // Orange for booked
        showCircle: false
      };
    }
    
    // Privacy categories: show circle
    if (isPrivacyCategory) {
      return {
        type: 'circle',
        radius: 500, // 500 meters
        showCircle: true
      };
    }
    
    // Other categories: show precise marker
    return {
      type: 'marker',
      icon: createCustomIcon('teal'),
      showCircle: false
    };
  };
  
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
      
      <MapBoundsUpdater listings={listings} />
      
      {listings.map((listing) => {
        const position = getListingPosition(listing);
        if (!position) return null;
        const markerConfig = getMarkerConfig(listing);
        
        return (
          <div key={listing.id}>
            {/* Circle for privacy categories */}
            {markerConfig.showCircle && (
              <Circle
                center={position}
                radius={markerConfig.radius}
                pathOptions={{
                  color: '#14b8a6',
                  fillColor: '#14b8a6',
                  fillOpacity: 0.15,
                  weight: 2
                }}
              >
                <Popup autoPan={true} autoPanPadding={[80, 60]} className="map-listing-popup">
                  <ListingPopupCard listing={listing} language={language} />
                </Popup>
              </Circle>
            )}
            
            {/* Marker (precise or for non-privacy categories) */}
            {!markerConfig.showCircle && (
              <Marker 
                position={position}
                icon={markerConfig.icon}
              >
                <Popup autoPan={true} autoPanPadding={[80, 60]} className="map-listing-popup">
                  <ListingPopupCard listing={listing} language={language} />
                </Popup>
              </Marker>
            )}
          </div>
        );
      })}
    </MapContainer>
  );
}
