import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar, Check, X, Loader2, CreditCard } from 'lucide-react'
import { PriceBreakdown } from './price-breakdown'
import { useState } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useCommission } from '@/hooks/use-commission'
import { resolveChatBookingBreakdown } from '@/lib/chat-booking-totals'

export function BookingRequestCard({
  message,
  userRole,
  onStatusUpdate,
  bookingStatus,
  listing = null,
  language = 'ru',
}) {
  const [updating, setUpdating] = useState(false)
  const commissionApi = useCommission()
  const metadata = message.metadata || {}
  const { checkIn, checkOut } = metadata
  const currentStatus = String(bookingStatus || 'PENDING').toUpperCase()

  const statusBadgeCopy =
    currentStatus === 'CANCELLED' || currentStatus === 'REFUNDED'
      ? { ru: 'Отменено', en: 'Cancelled' }
      : currentStatus === 'CONFIRMED'
        ? { ru: 'Подтверждено', en: 'Confirmed' }
        : currentStatus === 'PAID' || currentStatus === 'PAID_ESCROW'
          ? { ru: 'Оплачено', en: 'Paid' }
          : currentStatus === 'COMPLETED'
            ? { ru: 'Завершено', en: 'Completed' }
            : { ru: 'Ожидает ответа', en: 'Awaiting response' }
  const categorySlug = listing?.category_slug || metadata.listing_category_slug || ''
  const bd = resolveChatBookingBreakdown({ metadata, listingCategorySlug: categorySlug })
  const metaCr = Number(metadata.commissionRate)
  const commissionRate = Number.isFinite(metaCr) && metaCr >= 0
    ? metaCr
    : commissionApi.effectiveRate

  async function handleAccept() {
    setUpdating(true)
    try {
      const res = await fetch(`/api/v2/partner/bookings/${message.bookingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'CONFIRMED' }),
      })

      const data = await res.json()
      if (data.status === 'success') {
        toast.success('Бронирование подтверждено!')
        onStatusUpdate?.('CONFIRMED')
      } else {
        toast.error(data.error || 'Не удалось подтвердить')
      }
    } catch (error) {
      console.error('Failed to accept booking:', error)
      toast.error('Ошибка при подтверждении')
    } finally {
      setUpdating(false)
    }
  }

  async function handleDecline() {
    setUpdating(true)
    try {
      const res = await fetch(`/api/v2/partner/bookings/${message.bookingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'CANCELLED' }),
      })

      const data = await res.json()
      if (data.status === 'success') {
        toast.info('Бронирование отклонено')
        onStatusUpdate?.('CANCELLED')
      } else {
        toast.error(data.error || 'Не удалось отклонить')
      }
    } catch (error) {
      console.error('Failed to decline booking:', error)
      toast.error('Ошибка при отклонении')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="w-full max-w-full rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_4px_20px_-6px_rgba(15,23,42,0.1),0_2px_8px_-3px_rgba(15,23,42,0.06)] sm:p-5">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="rounded-2xl bg-slate-50 p-2">
              <Calendar className="h-5 w-5 text-teal-600" />
            </div>
            <span className="text-base font-bold leading-tight text-slate-900">Запрос на бронирование</span>
          </div>
          <Badge className="shrink-0 rounded-2xl bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
            {language === 'en' ? statusBadgeCopy.en : statusBadgeCopy.ru}
          </Badge>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <span className="font-medium text-slate-600">Даты</span>
            <span className="text-right font-bold text-slate-900">
              {checkIn && checkOut
                ? `${new Date(checkIn).toLocaleDateString('ru-RU')} — ${new Date(checkOut).toLocaleDateString('ru-RU')}`
                : '—'}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="font-medium text-slate-600">
              {bd.mode === 'tour' ? 'Гостей' : 'Дней'}
            </span>
            <span className="font-bold text-slate-900">{bd.quantity}</span>
          </div>
        </div>

        <PriceBreakdown
          basePrice={bd.unitPriceThb}
          days={bd.quantity}
          quantityLabel={bd.quantityLabelRu}
          commissionRate={commissionRate}
          currency="THB"
          className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4"
        />

        {userRole === 'PARTNER' && currentStatus === 'PENDING' && (
          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:gap-3">
            <Button
              onClick={handleAccept}
              disabled={updating}
              className="h-12 min-h-[48px] w-full flex-1 rounded-2xl bg-teal-600 text-base font-bold text-white shadow-sm hover:bg-teal-700 sm:w-auto"
            >
              {updating ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Check className="mr-2 h-5 w-5" />
                  Принять
                </>
              )}
            </Button>
            <Button
              onClick={handleDecline}
              disabled={updating}
              variant="outline"
              className="h-12 min-h-[48px] w-full flex-1 rounded-2xl border border-slate-200 bg-white text-base font-bold text-slate-700 hover:bg-slate-50 sm:w-auto"
            >
              {updating ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <X className="mr-2 h-5 w-5" />
                  Отклонить
                </>
              )}
            </Button>
          </div>
        )}

        {userRole === 'RENTER' && currentStatus === 'CONFIRMED' && (
          <Link href={`/checkout/${message.bookingId}`} className="block w-full">
            <Button className="h-12 min-h-[48px] w-full rounded-2xl bg-teal-600 text-base font-bold text-white shadow-sm hover:bg-teal-700">
              <CreditCard className="mr-2 h-5 w-5" />
              Оплатить бронирование
            </Button>
          </Link>
        )}

        {userRole === 'RENTER' && currentStatus === 'PENDING' && (
          <div className="text-sm text-slate-600 text-center py-2">
            Ожидаем ответа владельца...
          </div>
        )}
      </div>
    </div>
  )
}

export function SystemMessage({ message }) {
  const isConfirmed = message.type === 'BOOKING_CONFIRMED'
  const isCancelled = message.type === 'BOOKING_CANCELLED'

  return (
    <div className="flex justify-center py-2">
      <div className={`px-4 py-2 rounded-2xl text-sm font-medium ${
        isConfirmed
          ? 'bg-slate-100 text-slate-700'
          : isCancelled
          ? 'bg-slate-100 text-slate-700'
          : 'bg-slate-100 text-slate-700'
      }`}>
        {message.message}
      </div>
    </div>
  )
}