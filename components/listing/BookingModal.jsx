/**
 * BookingModal Component
 * Booking confirmation form with guest details.
 * Stage 178.1 — adaptive shell: Vaul Drawer (<md) | Radix Dialog (md+).
 */

'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { TimeSelect } from '@/components/ui/time-select'
import { Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { ru, enUS, th as thLocale, zhCN } from 'date-fns/locale'
import { formatPrice } from '@/lib/currency'
import { isTransportListingCategory } from '@/lib/listing-category-slug'
import { getUIText } from '@/lib/translations'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

function dateFnsLocaleForLang(language) {
  if (language === 'th') return thLocale
  if (language === 'zh') return zhCN
  if (language === 'en') return enUS
  return ru
}

function modalTitleKey(modalIntent) {
  if (modalIntent === 'private') return 'bookingModal_titlePrivate'
  if (modalIntent === 'special') return 'bookingModal_titleSpecial'
  if (modalIntent === 'contact') return 'bookingModal_titleContact'
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
  /** 'book' | 'private' | 'special' | 'contact' — inquiry flows create INQUIRY + chat */
  modalIntent = 'book',
  listingCategorySlug = '',
  vehicleStartTime = '07:00',
  vehicleEndTime = '07:00',
  setVehicleStartTime,
  setVehicleEndTime,
}) {
  const isMobile = useIsMobile()
  const [mobileViewportHeight, setMobileViewportHeight] = useState('100vh')

  const isVehicle = isTransportListingCategory(listingCategorySlug)
  const uiListingCtx = listingCategorySlug ? { listingCategorySlug } : undefined
  const tx = (key) => getUIText(key, language, uiListingCtx)
  const dateLocale = dateFnsLocaleForLang(language)
  const title = tx(modalTitleKey(modalIntent))

  useEffect(() => {
    if (!isMobile || typeof window === 'undefined' || !window.visualViewport) return undefined
    const updateViewportHeight = () => {
      setMobileViewportHeight(`${window.visualViewport.height}px`)
    }
    window.visualViewport.addEventListener('resize', updateViewportHeight)
    updateViewportHeight()
    return () => {
      window.visualViewport?.removeEventListener('resize', updateViewportHeight)
    }
  }, [isMobile])

  const mobileMaxHeightStyle = useMemo(
    () => ({ maxHeight: `min(92dvh, calc(${mobileViewportHeight} - 0.5rem))` }),
    [mobileViewportHeight],
  )

  const inquiryHint =
    modalIntent !== 'book' ? (
      <p className="mt-1 pr-2 text-sm font-normal text-slate-500">
        {tx(
          modalIntent === 'contact'
            ? 'bookingModal_inquiryHintContact'
            : 'bookingModal_inquiryHint',
        )}
      </p>
    ) : null

  const formFields = (
    <>
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
            <p className="pt-1 text-xs text-slate-600">
              {tx('bookingModal_guidePrice')}:{' '}
              <span className="font-semibold">
                {formatPrice(priceCalc.finalTotal, currency, exchangeRates, language)}
              </span>
            </p>
          )}
        </div>
      )}
    </>
  )

  const submitButton = (
    <Button
      type="submit"
      disabled={submitting}
      data-testid="booking-modal-confirm"
      variant="brand"
      className={cn('w-full', isMobile && 'min-h-12 text-base font-semibold')}
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
  )

  const bookingForm = (
    <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
      <div
        className={cn(
          'min-h-0 flex-1 overflow-y-auto overscroll-y-contain space-y-4 px-4 py-3 sm:px-6 sm:py-4',
          isMobile && 'pb-[max(1rem,env(safe-area-inset-bottom,0px))]',
        )}
      >
        {formFields}
      </div>

      <div
        className={cn(
          'shrink-0 border-t border-slate-100 bg-background px-4 py-3 sm:px-6 sm:py-4',
          'pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]',
        )}
      >
        {submitButton}
      </div>
    </form>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground>
        <DrawerContent
          style={mobileMaxHeightStyle}
          className={cn(
            'mt-0 flex max-h-[92dvh] flex-col rounded-t-[28px] border-slate-200 p-0',
            '[&>div:first-child]:mt-3',
          )}
        >
          <DrawerHeader className="shrink-0 border-b border-slate-100 px-4 pb-3 pt-1 text-left">
            <DrawerTitle className="text-lg font-semibold text-slate-900">{title}</DrawerTitle>
            {inquiryHint}
          </DrawerHeader>
          {bookingForm}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          'flex max-h-[90dvh] w-full max-w-md flex-col gap-0 overflow-hidden p-0 ' +
          'sm:max-h-[min(90dvh,calc(100vh-2rem))]'
        }
      >
        <DialogHeader className="shrink-0 border-b border-slate-100 px-4 pb-3 pt-2 pr-12 text-left sm:px-6 sm:pb-4 sm:pt-4 sm:pr-12">
          <DialogTitle>{title}</DialogTitle>
          {inquiryHint}
        </DialogHeader>
        {bookingForm}
      </DialogContent>
    </Dialog>
  )
}
