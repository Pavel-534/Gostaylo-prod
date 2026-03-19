'use client'

/**
 * AmenitiesGrid - Display listing amenities with icons
 * 
 * Features:
 * - Icon mapping for common amenities
 * - Responsive 2-column grid
 * - Bilingual support
 * 
 * @component
 */

import React from 'react'
import { 
  Wifi, Tv, Car, Dumbbell, Waves, Wind, Utensils, 
  Coffee, Shirt, Baby, Accessibility, UtensilsCrossed,
  Check
} from 'lucide-react'
import { getUIText, getAmenityName } from '@/lib/translations'

const AMENITY_ICONS = {
  'wifi': Wifi,
  'wi-fi': Wifi,
  'internet': Wifi,
  'tv': Tv,
  'television': Tv,
  'parking': Car,
  'gym': Dumbbell,
  'fitness': Dumbbell,
  'pool': Waves,
  'swimming pool': Waves,
  'ac': Wind,
  'air conditioning': Wind,
  'kitchen': Utensils,
  'coffee': Coffee,
  'washer': Shirt,
  'washing machine': Shirt,
  'crib': Baby,
  'baby': Baby,
  'wheelchair': Accessibility,
  'accessible': Accessibility,
  'restaurant': UtensilsCrossed,
  'dining': UtensilsCrossed,
}

export function AmenitiesGrid({ amenities, language = 'en' }) {
  if (!amenities || amenities.length === 0) {
    return null
  }

  return (
    <div>
      <h2 className="text-2xl font-medium tracking-tight mb-4">
        {getUIText('amenities', language)}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {amenities.map((amenity, idx) => {
          const Icon = AMENITY_ICONS[amenity.toLowerCase()] || Check
          return (
            <div 
              key={idx} 
              className="flex items-center gap-3 text-slate-700 py-2 border-b border-slate-50 last:border-0"
            >
              <Icon className="h-5 w-5 text-teal-600 flex-shrink-0" />
              <span>{getAmenityName(amenity, language) || amenity}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
