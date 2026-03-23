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
import { Users, Star, ArrowRight, MessageCircle } from 'lucide-react'
import { format } from 'date-fns'
import { formatPrice } from '@/lib/currency'
import { getUIText } from '@/lib/translations'
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
  onBookingClick,
  onAskPartner,
  askPartnerLoading = false,
  showAskPartner = false,
}) {
  const maxGuests = listing?.metadata?.max_guests || listing?.metadata?.guests || listing?.max_guests || 10

  return (
    <div className="hidden lg:block sticky top-24">
      <Card className="border-slate-200 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-3xl font-bold text-slate-900">
                {formatPrice(priceCalc?.avgPricePerNight || listing.basePriceThb, currency, exchangeRates)}
              </div>
              <p className="text-sm text-slate-500">
                {getUIText('perNight', language)}
              </p>
            </div>
            {(listing.rating > 0 || (listing.reviewsCount || listing.reviews_count || 0) > 0) && (
              <div className="flex items-center gap-1 text-sm">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="font-semibold">{(Number(listing.rating) || 0).toFixed(1)}</span>
                {(listing.reviewsCount || listing.reviews_count || 0) > 0 && (
                  <span className="text-slate-500">({listing.reviewsCount || listing.reviews_count})</span>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Calendar */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              {getUIText('travelDates', language)}
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
              {getUIText('numberOfGuests', language)}
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
                  {formatPrice(priceCalc.avgPricePerNight, currency, exchangeRates)} × {priceCalc.nights} {getUIText('nights', language)}
                </span>
                <span className="font-medium">{formatPrice(priceCalc.subtotal, currency, exchangeRates)}</span>
              </div>
              
              {priceCalc.serviceFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">{getUIText('serviceFee', language)}</span>
                  <span className="font-medium">{formatPrice(priceCalc.serviceFee, currency, exchangeRates)}</span>
                </div>
              )}
              
              <Separator />
              
              <div className="flex justify-between text-lg font-bold">
                <span>{getUIText('total', language)}</span>
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
            {getUIText('bookNow', language)}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          {showAskPartner && onAskPartner && (
            <Button
              type="button"
              variant="outline"
              onClick={onAskPartner}
              disabled={askPartnerLoading}
              className="w-full h-12 text-base border-teal-200 text-teal-800 hover:bg-teal-50"
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              {askPartnerLoading ? getUIText('loading', language) : getUIText('askListingQuestion', language)}
            </Button>
          )}

          {(!dateRange?.from || !dateRange?.to) && (
            <p className="text-xs text-center text-slate-500">
              {getUIText('selectDatesToBook', language)}
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
  onBookingClick,
  onAskPartner,
  askPartnerLoading = false,
  showAskPartner = false,
}) {
  const askLabel = askPartnerLoading ? getUIText('loading', language) : getUIText('askListingQuestion', language)

  return (
    <div
      className="lg:hidden fixed z-50 bg-white border-t border-slate-200 py-3 shadow-2xl left-[max(0px,env(safe-area-inset-left))] right-[max(0px,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))] px-3"
      style={{ bottom: 'calc(4.25rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums leading-tight">
            {formatPrice(priceCalc?.avgPricePerNight || listing.basePriceThb, currency, exchangeRates)}
          </div>
          <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
            {getUIText('perNight', language)}
            {priceCalc && ` • ${priceCalc.nights} ${getUIText('nights', language)}`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {showAskPartner && onAskPartner && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onAskPartner}
              disabled={askPartnerLoading}
              className="h-12 w-12 shrink-0 border-teal-200 text-teal-800 hover:bg-teal-50"
              aria-label={askLabel}
              title={askLabel}
            >
              <MessageCircle className="h-5 w-5" />
            </Button>
          )}
          <Button
            onClick={onBookingClick}
            disabled={!dateRange?.from || !dateRange?.to}
            className="h-12 min-w-[7.5rem] px-4 text-sm sm:text-base bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700"
          >
            {getUIText('bookNow', language)}
          </Button>
        </div>
      </div>
    </div>
  )
}
