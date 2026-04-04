'use client'

/**
 * BookingWidget - Sticky Desktop + Fixed Mobile Booking Interface
 * Category-aware: exclusive (property/vehicles) vs shared (tours/yachts/services).
 */

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Users, Star, ArrowRight, MessageCircle, Loader2, Sparkles } from 'lucide-react'
import { format } from 'date-fns'
import { formatPrice } from '@/lib/currency'
import { getUIText } from '@/lib/translations'
import { GostayloCalendar } from '@/components/gostaylo-calendar'
import { cn } from '@/lib/utils'

function ChatPreviewBadge({ preview, hasUnread, language }) {
  if (!preview) return null
  const label = preview.length > 55 ? preview.slice(0, 55) + '…' : preview
  return (
    <div
      className={`flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${
        hasUnread
          ? 'bg-amber-50 border border-amber-200 text-amber-800'
          : 'bg-slate-50 border border-slate-200 text-slate-500'
      }`}
    >
      {hasUnread && <span className="mt-px h-2 w-2 shrink-0 rounded-full bg-amber-500" />}
      <span className="leading-tight">
        {hasUnread
          ? language === 'ru'
            ? 'Новый ответ: '
            : 'New reply: '
          : language === 'ru'
            ? 'Последнее: '
            : 'Last: '}
        <span className="font-medium">{label}</span>
      </span>
    </div>
  )
}

export function PriceBreakdownBlock({ priceCalc, currency, exchangeRates, language }) {
  if (!priceCalc) return null
  const baseRaw = priceCalc.baseRawSubtotal
  const seasonalAdj = priceCalc.seasonalAdjustment
  const dur = priceCalc.durationDiscountAmount
  const hasSeasonal = seasonalAdj !== 0 && seasonalAdj != null
  const hasDur = dur > 0

  return (
    <div className="space-y-2 pt-4 border-t text-sm">
      {baseRaw != null && (
        <div className="flex justify-between gap-2">
          <span className="text-slate-600">
            {language === 'ru' ? 'База × ночей' : 'Base rate × nights'}
          </span>
          <span className="font-medium tabular-nums">{formatPrice(baseRaw, currency, exchangeRates)}</span>
        </div>
      )}
      {hasSeasonal && (
        <div className="flex justify-between gap-2">
          <span className="text-slate-600">
            {language === 'ru' ? 'Сезонная корректировка' : 'Seasonal adjustment'}
          </span>
          <span
            className={cn(
              'font-medium tabular-nums',
              seasonalAdj > 0 ? 'text-amber-800' : 'text-emerald-700'
            )}
          >
            {seasonalAdj > 0 ? '+' : ''}
            {formatPrice(seasonalAdj, currency, exchangeRates)}
          </span>
        </div>
      )}
      {hasDur && (
        <div className="flex justify-between gap-2">
          <span className="text-slate-600">
            {language === 'ru' ? 'Скидка за длительность' : 'Duration discount'}
          </span>
          <span className="font-medium text-emerald-700 tabular-nums">
            −{formatPrice(dur, currency, exchangeRates)}
            {priceCalc.durationDiscountPercent > 0
              ? ` (${priceCalc.durationDiscountPercent}%)`
              : ''}
          </span>
        </div>
      )}
      <div className="flex justify-between gap-2 pt-1">
        <span className="text-slate-600">{language === 'ru' ? 'Промежуточно' : 'Subtotal'}</span>
        <span className="font-medium tabular-nums">
          {formatPrice(priceCalc.subtotalBeforeFee ?? priceCalc.totalPrice, currency, exchangeRates)}
        </span>
      </div>
      {priceCalc.serviceFee > 0 && (
        <div className="flex justify-between gap-2">
          <span className="text-slate-600">{getUIText('serviceFee', language)}</span>
          <span className="font-medium tabular-nums">
            {formatPrice(priceCalc.serviceFee, currency, exchangeRates)}
          </span>
        </div>
      )}
      <Separator />
      <div className="flex justify-between text-lg font-bold">
        <span>{getUIText('total', language)}</span>
        <span className="tabular-nums">{formatPrice(priceCalc.finalTotal, currency, exchangeRates)}</span>
      </div>
    </div>
  )
}

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
  onAskPartnerUnavailable,
  askPartnerLoading = false,
  showAskPartner = false,
  hasExistingConversation = false,
  lastMessagePreview = null,
  hasUnreadFromHost = false,
  bookingUiMode = 'exclusive',
  availabilityLoading = false,
  availabilitySnapshot = null,
  durationDiscountPercentActive = 0,
  showDurationDiscountTeaser = false,
  onPrivateTripClick,
  onSpecialPriceClick,
  canInstantBook = true,
  exclusiveDatesUnavailable = false,
}) {
  const maxGuests =
    listing?.metadata?.max_guests || listing?.metadata?.guests || listing?.max_guests || listing?.maxCapacity || 50
  const maxCap = listing?.maxCapacity ?? availabilitySnapshot?.max_capacity ?? 1
  const remaining = availabilitySnapshot?.remaining_spots
  const sharedMode = bookingUiMode === 'shared'

  return (
    <div className="hidden lg:block sticky top-24">
      <Card className="border-slate-200 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-3xl font-bold text-slate-900">
                {formatPrice(priceCalc?.avgPricePerNight || listing.basePriceThb, currency, exchangeRates)}
              </div>
              <p className="text-sm text-slate-500">{getUIText('perNight', language)}</p>
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
          {sharedMode && dateRange?.from && dateRange?.to && (
            <div className="rounded-lg border border-teal-100 bg-teal-50/80 px-3 py-2 text-sm text-teal-900">
              {availabilityLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {language === 'ru' ? 'Проверяем места…' : 'Checking availability…'}
                </span>
              ) : remaining != null ? (
                <span>
                  {language === 'ru' ? 'Свободных мест' : 'Spots remaining'}:{' '}
                  <strong>{remaining}</strong>
                  {maxCap > 1 ? ` / ${maxCap}` : ''}
                </span>
              ) : null}
            </div>
          )}

          {exclusiveDatesUnavailable && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
              {language === 'ru' ? 'Выбранные даты заняты.' : 'These dates are unavailable.'}
            </div>
          )}

          {showDurationDiscountTeaser && durationDiscountPercentActive > 0 && (
            <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-sm text-emerald-900">
              <Sparkles className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                {language === 'ru' ? (
                  <>
                    Дольше — выгоднее! Ваша скидка: <strong>{durationDiscountPercentActive}%</strong>
                  </>
                ) : (
                  <>
                    Stay longer, save more! Your discount: <strong>{durationDiscountPercentActive}%</strong>
                  </>
                )}
              </p>
            </div>
          )}

          <div>
            <Label className="text-sm font-medium mb-2 block">{getUIText('travelDates', language)}</Label>
            <GostayloCalendar
              key={calendarKey}
              listingId={listing.id}
              value={dateRange}
              onChange={setDateRange}
              minStay={listing.minStay}
              language={language}
            />
          </div>

          <div>
            <Label className="text-sm font-medium mb-2 block">{getUIText('numberOfGuests', language)}</Label>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-400" />
              <Input
                type="number"
                min="1"
                max={maxGuests}
                value={guests}
                onChange={(e) => setGuests(parseInt(e.target.value, 10) || 1)}
                className="h-12"
              />
            </div>
          </div>

          <PriceBreakdownBlock
            priceCalc={priceCalc}
            currency={currency}
            exchangeRates={exchangeRates}
            language={language}
          />

          <Button
            onClick={onBookingClick}
            disabled={!dateRange?.from || !dateRange?.to || !canInstantBook || availabilityLoading}
            className="w-full h-12 text-base bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700"
          >
            {exclusiveDatesUnavailable
              ? language === 'ru'
                ? 'Даты недоступны'
                : 'Dates unavailable'
              : getUIText('bookNow', language)}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          {sharedMode && (onPrivateTripClick || onSpecialPriceClick) && (
            <div className="grid gap-2">
              {onPrivateTripClick && (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full h-11 border border-teal-200 bg-white text-teal-900 hover:bg-teal-50"
                  onClick={onPrivateTripClick}
                  disabled={!dateRange?.from || !dateRange?.to}
                >
                  {language === 'ru'
                    ? 'Запросить приватный тур / индивидуальную цену'
                    : 'Request private trip / individual price'}
                </Button>
              )}
              {onSpecialPriceClick && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 border-dashed border-slate-300 text-slate-700"
                  onClick={onSpecialPriceClick}
                  disabled={!dateRange?.from || !dateRange?.to}
                >
                  {language === 'ru' ? 'Запросить особую цену' : 'Request special price'}
                </Button>
              )}
            </div>
          )}

          {exclusiveDatesUnavailable && (onAskPartnerUnavailable || onAskPartner) && (
            <Button
              type="button"
              variant="outline"
              className="w-full h-12 border-teal-300 text-teal-900 hover:bg-teal-50"
              onClick={onAskPartnerUnavailable || onAskPartner}
              disabled={askPartnerLoading}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              {language === 'ru' ? 'Спросить у хозяина в чате' : 'Ask partner in chat'}
            </Button>
          )}

          {showAskPartner && onAskPartner && !exclusiveDatesUnavailable && (
            <div className="space-y-1.5">
              <Button
                type="button"
                variant="outline"
                onClick={onAskPartner}
                disabled={askPartnerLoading}
                className={`w-full h-12 text-base border-teal-200 text-teal-800 hover:bg-teal-50 ${
                  hasUnreadFromHost ? 'border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900' : ''
                }`}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                {askPartnerLoading
                  ? getUIText('loading', language)
                  : hasExistingConversation
                    ? language === 'ru'
                      ? 'Продолжить диалог'
                      : 'Continue chat'
                    : getUIText('askListingQuestion', language)}
              </Button>
              <ChatPreviewBadge
                preview={lastMessagePreview}
                hasUnread={hasUnreadFromHost}
                language={language}
              />
            </div>
          )}

          {(!dateRange?.from || !dateRange?.to) && (
            <p className="text-xs text-center text-slate-500">{getUIText('selectDatesToBook', language)}</p>
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
  onAskPartnerUnavailable,
  askPartnerLoading = false,
  showAskPartner = false,
  hasExistingConversation = false,
  lastMessagePreview = null,
  hasUnreadFromHost = false,
  bookingUiMode = 'exclusive',
  availabilityLoading = false,
  canInstantBook = true,
  exclusiveDatesUnavailable = false,
  onPrivateTripClick,
  onSpecialPriceClick,
}) {
  const askLabel = askPartnerLoading
    ? getUIText('loading', language)
    : hasExistingConversation
      ? language === 'ru'
        ? 'Продолжить диалог'
        : 'Continue chat'
      : getUIText('askListingQuestion', language)

  const sharedMode = bookingUiMode === 'shared'

  return (
    <div
      className="lg:hidden fixed z-50 bg-white border-t border-slate-200 py-3 shadow-2xl left-[max(0px,env(safe-area-inset-left))] right-[max(0px,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))] px-3"
      style={{ bottom: 'calc(4.25rem + env(safe-area-inset-bottom, 0px))' }}
    >
      {sharedMode && dateRange?.from && dateRange?.to && (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          {availabilityLoading && (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {language === 'ru' ? 'Места…' : 'Spots…'}
            </span>
          )}
          {!availabilityLoading && onPrivateTripClick && (
            <button
              type="button"
              className="text-teal-700 font-medium underline-offset-2 hover:underline"
              onClick={onPrivateTripClick}
            >
              {language === 'ru' ? 'Приват / цена' : 'Private / quote'}
            </button>
          )}
          {!availabilityLoading && onSpecialPriceClick && (
            <button
              type="button"
              className="text-slate-600 underline-offset-2 hover:underline"
              onClick={onSpecialPriceClick}
            >
              {language === 'ru' ? 'Особая цена' : 'Special price'}
            </button>
          )}
        </div>
      )}

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
          {exclusiveDatesUnavailable && (onAskPartnerUnavailable || onAskPartner) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAskPartnerUnavailable || onAskPartner}
              disabled={askPartnerLoading}
              className="h-12 px-3 border-teal-300 text-teal-900"
            >
              <MessageCircle className="h-5 w-5 sm:mr-1" />
              <span className="hidden sm:inline">
                {language === 'ru' ? 'В чат' : 'Chat'}
              </span>
            </Button>
          )}
          {showAskPartner && onAskPartner && !exclusiveDatesUnavailable && (
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={onAskPartner}
                disabled={askPartnerLoading}
                className={`h-12 w-12 shrink-0 border-teal-200 text-teal-800 hover:bg-teal-50 ${
                  hasUnreadFromHost ? 'border-amber-300 bg-amber-50 text-amber-900' : ''
                }`}
                aria-label={askLabel}
                title={lastMessagePreview ? `${askLabel}: ${lastMessagePreview}` : askLabel}
              >
                <MessageCircle className="h-5 w-5" />
              </Button>
              {hasUnreadFromHost && (
                <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-500 ring-1 ring-white" />
              )}
            </div>
          )}
          <Button
            onClick={onBookingClick}
            disabled={!dateRange?.from || !dateRange?.to || !canInstantBook || availabilityLoading}
            className="h-12 min-w-[7.5rem] px-4 text-sm sm:text-base bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700"
          >
            {exclusiveDatesUnavailable
              ? language === 'ru'
                ? 'Недоступно'
                : 'Unavailable'
              : getUIText('bookNow', language)}
          </Button>
        </div>
      </div>
    </div>
  )
}
