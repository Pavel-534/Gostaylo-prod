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
import { Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { formatPrice } from '@/lib/currency'

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
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          'flex max-h-[90dvh] w-full max-w-md flex-col gap-0 overflow-hidden p-0 ' +
          'sm:max-h-[min(90dvh,calc(100vh-2rem))]'
        }
      >
        <DialogHeader className="shrink-0 border-b border-slate-100 px-4 pb-3 pt-2 pr-12 text-left sm:px-6 sm:pb-4 sm:pt-4 sm:pr-12">
          <DialogTitle>
            {modalIntent === 'book'
              ? language === 'ru'
                ? 'Подтвердите бронирование'
                : 'Confirm booking'
              : modalIntent === 'private'
                ? language === 'ru'
                  ? 'Запрос приватного тура'
                  : 'Private trip request'
                : language === 'ru'
                  ? 'Запрос особой цены'
                  : 'Special price request'}
          </DialogTitle>
          {modalIntent !== 'book' && (
            <p className="text-sm text-slate-500 font-normal mt-1 pr-2">
              {language === 'ru'
                ? 'Мы создадим чат с хозяином и запрос цены. Итоговая сумма по счёту в чате.'
                : 'We will open a chat with the host for a custom quote. Final amount via invoice in chat.'}
            </p>
          )}
        </DialogHeader>

        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div
            className={
              'min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-3 ' +
              'sm:px-6 sm:py-4 space-y-4'
            }
          >
            <div>
              <Label>{language === 'ru' ? 'Имя' : 'Name'}</Label>
              <Input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
            <div>
              <Label>{language === 'ru' ? 'Email' : 'Email'}</Label>
              <Input
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <Label>{language === 'ru' ? 'Телефон' : 'Phone'}</Label>
              <Input
                type="tel"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                required
                autoComplete="tel"
              />
            </div>
            <div>
              <Label>{language === 'ru' ? 'Особые пожелания' : 'Special Requests'}</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="min-h-[80px] resize-y"
              />
            </div>

            {priceCalc && dateRange?.from && dateRange?.to && (
              <div className="space-y-1 rounded-lg bg-slate-50 p-4">
                <div className="flex justify-between text-sm">
                  <span>{language === 'ru' ? 'Даты' : 'Dates'}:</span>
                  <span>
                    {format(dateRange.from, 'd MMM', { locale: ru })} -{' '}
                    {format(dateRange.to, 'd MMM', { locale: ru })}
                  </span>
                </div>
                {modalIntent === 'book' ? (
                  <div className="flex justify-between text-sm font-semibold">
                    <span>{language === 'ru' ? 'Итого' : 'Total'}:</span>
                    <span>{formatPrice(priceCalc.finalTotal, currency, exchangeRates, language)}</span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-600 pt-1">
                    {language === 'ru' ? 'Ориентир' : 'Guide price'}:{' '}
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
              className="w-full bg-teal-600 hover:bg-teal-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {language === 'ru' ? 'Отправка...' : 'Submitting...'}
                </>
              ) : modalIntent === 'book' ? (
                language === 'ru' ? (
                  'Подтвердить'
                ) : (
                  'Confirm booking'
                )
              ) : language === 'ru' ? (
                'Отправить запрос'
              ) : (
                'Send request'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
