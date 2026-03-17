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
  onSubmit
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {language === 'ru' ? 'Подтвердите бронирование' : 'Confirm Booking'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label>{language === 'ru' ? 'Имя' : 'Name'}</Label>
            <Input 
              value={guestName} 
              onChange={(e) => setGuestName(e.target.value)} 
              required 
            />
          </div>
          <div>
            <Label>{language === 'ru' ? 'Email' : 'Email'}</Label>
            <Input 
              type="email" 
              value={guestEmail} 
              onChange={(e) => setGuestEmail(e.target.value)} 
              required 
            />
          </div>
          <div>
            <Label>{language === 'ru' ? 'Телефон' : 'Phone'}</Label>
            <Input 
              type="tel" 
              value={guestPhone} 
              onChange={(e) => setGuestPhone(e.target.value)} 
              required 
            />
          </div>
          <div>
            <Label>{language === 'ru' ? 'Особые пожелания' : 'Special Requests'}</Label>
            <Textarea 
              value={message} 
              onChange={(e) => setMessage(e.target.value)} 
              rows={3} 
            />
          </div>
          
          {priceCalc && dateRange?.from && dateRange?.to && (
            <div className="bg-slate-50 p-4 rounded-lg space-y-1">
              <div className="flex justify-between text-sm">
                <span>{language === 'ru' ? 'Даты' : 'Dates'}:</span>
                <span>
                  {format(dateRange.from, 'd MMM', { locale: ru })} - {format(dateRange.to, 'd MMM', { locale: ru })}
                </span>
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <span>{language === 'ru' ? 'Итого' : 'Total'}:</span>
                <span>{formatPrice(priceCalc.finalTotal, currency, exchangeRates)}</span>
              </div>
            </div>
          )}
          
          <Button 
            type="submit" 
            disabled={submitting} 
            className="w-full bg-teal-600 hover:bg-teal-700"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {language === 'ru' ? 'Отправка...' : 'Submitting...'}
              </>
            ) : (
              language === 'ru' ? 'Подтвердить' : 'Confirm Booking'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
