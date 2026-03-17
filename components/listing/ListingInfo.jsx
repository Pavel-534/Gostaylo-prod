/**
 * ListingInfo Component
 * Displays listing description, specifications, and host information
 */

'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { MapPin, Star, Bed, Bath, Users, Square, User } from 'lucide-react'

export function ListingInfo({ listing, language = 'en' }) {
  const bedrooms = listing?.metadata?.bedrooms || 0
  const bathrooms = listing?.metadata?.bathrooms || 0
  const maxGuests = listing?.metadata?.max_guests || listing?.metadata?.guests || 4
  const area = listing?.metadata?.area || 0
  
  return (
    <div className="space-y-8">
      {/* Title & Location */}
      <div>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900 mb-2">
              {listing.title}
            </h1>
            <div className="flex items-center gap-4 text-slate-600">
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                <span>{listing.district}</span>
              </div>
              {listing.rating > 0 && (
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="font-medium">{listing.rating.toFixed(1)}</span>
                  <span className="text-slate-400">
                    ({listing.reviewsCount} {language === 'ru' ? 'отзывов' : 'reviews'})
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Specs */}
        <div className="flex items-center gap-6 text-slate-700 py-4 border-y border-slate-100">
          {bedrooms > 0 && (
            <div className="flex items-center gap-2">
              <Bed className="h-5 w-5 text-slate-400" />
              <span>{bedrooms} {language === 'ru' ? 'спален' : 'bedrooms'}</span>
            </div>
          )}
          {bathrooms > 0 && (
            <div className="flex items-center gap-2">
              <Bath className="h-5 w-5 text-slate-400" />
              <span>{bathrooms} {language === 'ru' ? 'ванных' : 'bathrooms'}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-400" />
            <span>{maxGuests} {language === 'ru' ? 'гостей' : 'guests'}</span>
          </div>
          {area > 0 && (
            <div className="flex items-center gap-2">
              <Square className="h-5 w-5 text-slate-400" />
              <span>{area} m²</span>
            </div>
          )}
        </div>
      </div>
      
      <Separator />
      
      {/* Description */}
      <div>
        <h2 className="text-2xl font-medium tracking-tight mb-4">
          {language === 'ru' ? 'Описание' : 'Description'}
        </h2>
        <p className="text-base leading-relaxed text-slate-600 whitespace-pre-wrap">
          {listing.description}
        </p>
      </div>
      
      <Separator />
      
      {/* Host Section */}
      {listing.owner && (
        <>
          <div>
            <h2 className="text-2xl font-medium tracking-tight mb-4">
              {language === 'ru' ? 'Хозяин' : 'Meet your Host'}
            </h2>
            <Card className="border-slate-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center">
                    <User className="h-8 w-8 text-teal-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-lg">
                      {listing.owner.first_name} {listing.owner.last_name}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {language === 'ru' ? 'Владелец' : 'Property Owner'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <Separator />
        </>
      )}
    </div>
  )
}
