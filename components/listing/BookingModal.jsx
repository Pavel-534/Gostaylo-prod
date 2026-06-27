/**
 * BookingModal Component
 * Booking confirmation form with guest details
 */

'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TimeSelect } from '@/components/ui/time-select'
import { Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { ru, enUS, th as thLocale, zhCN } from 'date-fns/locale'
import { formatPrice } from '@/lib/currency'
import { isTransportListingCategory } from '@/lib/listing-category-slug'
import { getUIText } from '@/lib/translations'

function dateFnsLocaleForLang(language) {
  if (language === 'th') return thLocale
  if (language === 'zh') return zhCN
  if (language === 'en') return enUS
  return ru
}

function modalTitleKey(modalIntent) {
  if (modalIntent === 'private') return 'bookingModal_titlePrivate'
  if (modalIntent === 'special') return 'bookingModal_titleSpecial'
  return 'bookingModal_titleBook'
}

export function BookingModal({
  open,
  onOpenChange,
  guestName,
  setGuestName,
  guestEmail,
  setGuestEmail,
  guestPhone,
  setGuestPhone,
  message,
  setMessage,
  dateRange,
  priceCalc,
  currency,
  exchangeRates,
  language,
  submitting,
  onSubmit,
  /** 'book' | 'private' | 'special' — inquiry flows create INQUIRY + chat */
  modalIntent = 'book',
  listingCategorySlug = '',
  vehicleStartTime = '07:00',
  vehicleEndTime = '07:00',
  setVehicleStartTime,
  setVehicleEndTime,
}) {
  const isVehicle = isTransportListingCategory(listingCategorySlug)
  const tx = (key) => getUIText(key, language)
  const dateLocale = dateFnsLocaleForLang(language)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          'flex max-h-[90dvh] w-full max-w-md flex-col gap-0 overflow-hidden p-0 ' +
          'sm:max-h-[min(90dvh,calc(100vh-2rem))]'
        }
      >
        <DialogHeader className="shrink-0 border-b border-slate-100 px-4 pb-3 pt-2 pr-12 text-left sm:px-6 sm:pb-4 sm:pt-4 sm:pr-12">
          <DialogTitle>{tx(modalTitleKey(modalIntent))}</DialogTitle>
          {modalIntent !== 'book' && (
            <p className="text-sm text-slate-500 font-normal mt-1 pr-2">{tx('bookingModal_inquiryHint')}</p>
          )}
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div
            className={
              'min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-3 ' +
              'sm:px-6 sm:py-4 space-y-4'
            }
          >
            <div>
              <Label>{tx('bookingModal_name')}</Label>
              <Input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
            <div>
              <Label>{tx('bookingModal_email')}</Label>
              <Input
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <Label>{tx('bookingModal_phone')}</Label>
              <Input
                type="tel"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                required
                autoComplete="tel"
              />
            </div>
            <div>
              <Label>{tx('bookingModal_specialRequests')}</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="min-h-[80px] resize-y"
              />
            </div>

            {isVehicle && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{tx('bookingModal_startTime')}</Label>
                  <TimeSelect value={vehicleStartTime} onChange={setVehicleStartTime} />
                </div>
                <div>
                  <Label>{tx('bookingModal_endTime')}</Label>
                  <TimeSelect value={vehicleEndTime} onChange={setVehicleEndTime} />
                </div>
              </div>
            )}

            {priceCalc && dateRange?.from && dateRange?.to && (
              <div className="space-y-1 rounded-lg bg-slate-50 p-4">
                <div className="flex justify-between text-sm">
                  <span>{tx('bookingModal_dates')}:</span>
                  <span>
                    {format(dateRange.from, 'd MMM', { locale: dateLocale })} -{' '}
                    {format(dateRange.to, 'd MMM', { locale: dateLocale })}
                  </span>
                </div>
                {modalIntent === 'book' ? (
                  <div className="flex justify-between text-sm font-semibold">
                    <span>{tx('bookingModal_total')}:</span>
                    <span>{formatPrice(priceCalc.finalTotal, currency, exchangeRates, language)}</span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-600 pt-1">
                    {tx('bookingModal_guidePrice')}:{' '}
                    <span className="font-semibold">
                      {formatPrice(priceCalc.finalTotal, currency, exchangeRates, language)}
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>

          <div
            className={
              'shrink-0 border-t border-slate-100 bg-background px-4 py-3 ' +
              'pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-4'
            }
          >
            <Button
              type="submit"
              disabled={submitting}
              data-testid="booking-modal-confirm"
              variant="brand"
              className="w-full"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tx('bookingModal_submitting')}
                </>
              ) : modalIntent === 'book' ? (
                tx('bookingModal_confirmBook')
              ) : (
                tx('bookingModal_sendRequest')
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
