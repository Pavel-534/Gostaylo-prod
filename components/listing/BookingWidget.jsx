'use client'

/**
 * BookingWidget - Sticky Desktop + Fixed Mobile Booking Interface
 * 
 * Features:
 * - Desktop: Sticky sidebar widget with calendar
 * - Mobile: Fixed bottom bar with price + CTA
 * - Real-time price calculation
 * - Date range validation
 * - Guest count selector
 * 
 * @component
 */

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { CalendarIcon, Users, Star, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'
import { formatPrice } from '@/lib/currency'
import { GostayloCalendar } from '@/components/gostaylo-calendar'

export function DesktopBookingWidget({
  listing,
  dateRange,
  setDateRange,
  guests,
  setGuests,
  priceCalc,
  currency,
  exchangeRates,
  language,
  calendarKey,
  onBookingClick
}) {
  const maxGuests = listing.max_guests || 10

  return (
    <div className="hidden lg:block sticky top-24">
      <Card className="border-slate-200 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-3xl font-bold text-slate-900">
                {formatPrice(priceCalc?.avgPricePerNight || listing.price_per_night, currency, exchangeRates)}
              </div>
              <p className="text-sm text-slate-500">
                {language === 'ru' ? 'за ночь' : 'per night'}
              </p>
            </div>
            {listing.rating && (
              <div className="flex items-center gap-1 text-sm">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="font-semibold">{listing.rating.toFixed(1)}</span>
                {listing.reviews_count > 0 && (
                  <span className="text-slate-500">({listing.reviews_count})</span>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Calendar */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              {language === 'ru' ? 'Даты проживания' : 'Travel Dates'}
            </Label>
            <GostayloCalendar
              key={calendarKey}
              listingId={listing.id}
              value={dateRange}
              onChange={setDateRange}
              minStay={listing.minStay}
              language={language}
            />
          </div>

          {/* Guests */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              {language === 'ru' ? 'Количество гостей' : 'Number of Guests'}
            </Label>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-400" />
              <Input
                type="number"
                min="1"
                max={maxGuests}
                value={guests}
                onChange={(e) => setGuests(parseInt(e.target.value) || 1)}
                className="h-12"
              />
            </div>
          </div>

          {/* Price Breakdown */}
          {priceCalc && (
            <div className="space-y-3 pt-4 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">
                  {formatPrice(priceCalc.avgPricePerNight, currency, exchangeRates)} × {priceCalc.nights} {language === 'ru' ? 'ночей' : 'nights'}
                </span>
                <span className="font-medium">{formatPrice(priceCalc.subtotal, currency, exchangeRates)}</span>
              </div>
              
              {priceCalc.serviceFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">{language === 'ru' ? 'Сервисный сбор' : 'Service fee'}</span>
                  <span className="font-medium">{formatPrice(priceCalc.serviceFee, currency, exchangeRates)}</span>
                </div>
              )}
              
              <Separator />
              
              <div className="flex justify-between text-lg font-bold">
                <span>{language === 'ru' ? 'Итого' : 'Total'}</span>
                <span>{formatPrice(priceCalc.finalTotal, currency, exchangeRates)}</span>
              </div>
            </div>
          )}

          {/* Book Button */}
          <Button 
            onClick={onBookingClick}
            disabled={!dateRange?.from || !dateRange?.to}
            className="w-full h-12 text-base bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700"
          >
            {language === 'ru' ? 'Забронировать' : 'Book Now'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          {(!dateRange?.from || !dateRange?.to) && (
            <p className="text-xs text-center text-slate-500">
              {language === 'ru' ? 'Выберите даты для бронирования' : 'Select dates to book'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function MobileBookingBar({
  priceCalc,
  listing,
  currency,
  exchangeRates,
  language,
  dateRange,
  onBookingClick
}) {
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-2xl z-40">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-2xl font-bold text-slate-900">
            {formatPrice(priceCalc?.avgPricePerNight || listing.price_per_night, currency, exchangeRates)}
          </div>
          <p className="text-xs text-slate-500">
            {language === 'ru' ? 'за ночь' : 'per night'}
            {priceCalc && ` • ${priceCalc.nights} ${language === 'ru' ? 'ночей' : 'nights'}`}
          </p>
        </div>
        
        <Button 
          onClick={onBookingClick}
          disabled={!dateRange?.from || !dateRange?.to}
          className="h-12 px-8 text-base bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700"
        >
          {language === 'ru' ? 'Забронировать' : 'Book'}
        </Button>
      </div>
    </div>
  )
}
