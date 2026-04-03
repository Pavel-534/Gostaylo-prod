import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Check, X, Loader2, CreditCard } from 'lucide-react'
import { PriceBreakdown } from './price-breakdown'
import { formatPrice } from '@/lib/currency'
import { useState } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useCommission } from '@/hooks/use-commission'

export function BookingRequestCard({ message, userRole, onStatusUpdate, bookingStatus }) {
  const [updating, setUpdating] = useState(false)
  const commissionApi = useCommission()
  const metadata = message.metadata || {}
  const { checkIn, checkOut, serviceFee, totalPrice } = metadata
  const days = Math.max(1, Number(metadata.days) || 1)
  const basePrice = Number(metadata.basePrice) || 0
  const currentStatus = bookingStatus || 'PENDING'
  const metaCr = Number(metadata.commissionRate)
  const commissionRate = Number.isFinite(metaCr) && metaCr >= 0
    ? metaCr
    : commissionApi.effectiveRate

  async function handleAccept() {
    setUpdating(true)
    try {
      const res = await fetch(`/api/partner/bookings/${message.bookingId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CONFIRMED' }),
      })

      const data = await res.json()
      if (data.success) {
        // Send system message
        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: message.conversationId,
            senderId: 'system',
            senderRole: 'SYSTEM',
            message: 'Бронирование подтверждено владельцем ✓',
            type: 'BOOKING_CONFIRMED',
          }),
        })

        toast.success('Бронирование подтверждено!')
        onStatusUpdate?.('CONFIRMED')
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
      const res = await fetch(`/api/partner/bookings/${message.bookingId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      })

      const data = await res.json()
      if (data.success) {
        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: message.conversationId,
            senderId: 'system',
            senderRole: 'SYSTEM',
            message: 'Бронирование отклонено владельцем',
            type: 'BOOKING_CANCELLED',
          }),
        })

        toast.info('Бронирование отклонено')
        onStatusUpdate?.('CANCELLED')
      }
    } catch (error) {
      console.error('Failed to decline booking:', error)
      toast.error('Ошибка при отклонении')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <Card className="p-4 bg-blue-50 border-blue-200">
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            <span className="font-semibold text-slate-900">Запрос на бронирование</span>
          </div>
          <Badge className="bg-yellow-100 text-yellow-700">Ожидает ответа</Badge>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Даты:</span>
            <span className="font-medium">
              {checkIn && checkOut
                ? `${new Date(checkIn).toLocaleDateString('ru-RU')} - ${new Date(checkOut).toLocaleDateString('ru-RU')}`
                : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Дней:</span>
            <span className="font-medium">{days}</span>
          </div>
        </div>

        <PriceBreakdown
          basePrice={days > 0 ? basePrice / days : basePrice}
          days={days}
          commissionRate={commissionRate}
          currency="THB"
          className="bg-white p-3 rounded-lg border"
        />

        {userRole === 'PARTNER' && (
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleAccept}
              disabled={updating}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {updating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Принять
                </>
              )}
            </Button>
            <Button
              onClick={handleDecline}
              disabled={updating}
              variant="outline"
              className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
            >
              {updating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Отклонить
                </>
              )}
            </Button>
          </div>
        )}

        {userRole === 'RENTER' && currentStatus === 'CONFIRMED' && (
          <Link href={`/checkout/${message.bookingId}`}>
            <Button className="w-full bg-teal-600 hover:bg-teal-700">
              <CreditCard className="h-4 w-4 mr-2" />
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
    </Card>
  )
}

export function SystemMessage({ message }) {
  const isConfirmed = message.type === 'BOOKING_CONFIRMED'
  const isCancelled = message.type === 'BOOKING_CANCELLED'

  return (
    <div className="flex justify-center py-2">
      <div className={`px-4 py-2 rounded-full text-sm font-medium ${
        isConfirmed
          ? 'bg-green-100 text-green-700'
          : isCancelled
          ? 'bg-red-100 text-red-700'
          : 'bg-slate-100 text-slate-700'
      }`}>
        {message.message}
      </div>
    </div>
  )
}