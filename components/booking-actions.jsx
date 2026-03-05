/**
 * Gostaylo - Booking Actions in Chat
 * Quick Approve/Reject buttons for partners to handle booking requests
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  Check, X, Loader2, Calendar, Users, 
  CreditCard, AlertTriangle, Home 
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

// Status colors
const STATUS_STYLES = {
  PENDING: 'bg-amber-100 text-amber-800 border-amber-300',
  CONFIRMED: 'bg-green-100 text-green-800 border-green-300',
  PAID: 'bg-blue-100 text-blue-800 border-blue-300',
  PAID_ESCROW: 'bg-teal-100 text-teal-800 border-teal-300',
  CANCELLED: 'bg-red-100 text-red-800 border-red-300',
  REJECTED: 'bg-red-100 text-red-800 border-red-300',
};

const STATUS_LABELS = {
  PENDING: 'Ожидает подтверждения',
  CONFIRMED: 'Подтверждено',
  PAID: 'Оплачено',
  PAID_ESCROW: 'В эскроу',
  CANCELLED: 'Отменено',
  REJECTED: 'Отклонено',
};

export function BookingActionCard({ booking, listing, onUpdate, isPartner = true }) {
  const [loading, setLoading] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const canApprove = booking?.status === 'PENDING' && isPartner;
  const canReject = booking?.status === 'PENDING' && isPartner;

  const handleApprove = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v2/bookings/${booking.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      
      if (data.success) {
        toast.success('Бронирование подтверждено!');
        onUpdate?.({ ...booking, status: 'CONFIRMED' });
      } else {
        toast.error(data.error || 'Ошибка подтверждения');
      }
    } catch (error) {
      console.error('Approve error:', error);
      toast.error('Ошибка сервера');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Укажите причину отказа');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/v2/bookings/${booking.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });

      const data = await res.json();
      
      if (data.success) {
        toast.success('Бронирование отклонено');
        setShowRejectDialog(false);
        onUpdate?.({ ...booking, status: 'REJECTED' });
      } else {
        toast.error(data.error || 'Ошибка отклонения');
      }
    } catch (error) {
      console.error('Reject error:', error);
      toast.error('Ошибка сервера');
    } finally {
      setLoading(false);
    }
  };

  if (!booking) return null;

  return (
    <>
      <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-white shadow-md">
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Home className="h-5 w-5 text-amber-600" />
              <span className="font-semibold text-slate-800">Заявка на бронирование</span>
            </div>
            <Badge className={STATUS_STYLES[booking.status] || 'bg-gray-100'}>
              {STATUS_LABELS[booking.status] || booking.status}
            </Badge>
          </div>

          {/* Listing Info */}
          {listing && (
            <div className="mb-3 p-2 bg-white rounded-lg border">
              <p className="font-medium text-slate-800 truncate">{listing.title}</p>
            </div>
          )}

          {/* Booking Details */}
          <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
            <div className="flex items-center gap-2 text-slate-600">
              <Calendar className="h-4 w-4" />
              <span>
                {booking.check_in && format(new Date(booking.check_in), 'd MMM', { locale: ru })}
                {' — '}
                {booking.check_out && format(new Date(booking.check_out), 'd MMM', { locale: ru })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Users className="h-4 w-4" />
              <span>{booking.guests || 1} гостей</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600 col-span-2">
              <CreditCard className="h-4 w-4" />
              <span className="font-semibold text-green-600">
                ฿{booking.price_thb?.toLocaleString() || 0}
              </span>
            </div>
          </div>

          {/* Guest Info */}
          {booking.guest_name && (
            <div className="mb-4 p-2 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-500">Гость</p>
              <p className="font-medium">{booking.guest_name}</p>
              {booking.guest_email && (
                <p className="text-xs text-slate-500">{booking.guest_email}</p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {(canApprove || canReject) && (
            <div className="flex gap-2">
              {canApprove && (
                <Button
                  onClick={handleApprove}
                  disabled={loading}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  data-testid="booking-approve-btn"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Подтвердить
                </Button>
              )}
              {canReject && (
                <Button
                  onClick={() => setShowRejectDialog(true)}
                  disabled={loading}
                  variant="destructive"
                  className="flex-1"
                  data-testid="booking-reject-btn"
                >
                  <X className="h-4 w-4 mr-2" />
                  Отклонить
                </Button>
              )}
            </div>
          )}

          {/* Status Message for non-pending */}
          {booking.status === 'CONFIRMED' && (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg">
              <Check className="h-5 w-5" />
              <span className="font-medium">Бронирование подтверждено. Ожидаем оплату.</span>
            </div>
          )}
          
          {booking.status === 'PAID_ESCROW' && (
            <div className="flex items-center gap-2 text-teal-600 bg-teal-50 p-3 rounded-lg">
              <CreditCard className="h-5 w-5" />
              <span className="font-medium">Оплачено. Средства в эскроу до заезда.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Отклонить бронирование
            </DialogTitle>
            <DialogDescription>
              Пожалуйста, укажите причину отказа. Это сообщение будет отправлено гостю.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Textarea
              placeholder="Причина отказа (например: даты заняты, объект на ремонте...)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="min-h-[100px]"
              data-testid="reject-reason-input"
            />
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
              disabled={loading}
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={loading || !rejectReason.trim()}
              data-testid="confirm-reject-btn"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <X className="h-4 w-4 mr-2" />
              )}
              Отклонить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Compact inline version for chat messages
export function BookingActionInline({ booking, onApprove, onReject, loading }) {
  if (!booking || booking.status !== 'PENDING') return null;

  return (
    <div className="flex gap-2 mt-2">
      <Button
        size="sm"
        onClick={onApprove}
        disabled={loading}
        className="bg-green-600 hover:bg-green-700 h-8"
        data-testid="inline-approve-btn"
      >
        <Check className="h-3 w-3 mr-1" />
        Подтвердить
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={onReject}
        disabled={loading}
        className="border-red-300 text-red-600 hover:bg-red-50 h-8"
        data-testid="inline-reject-btn"
      >
        <X className="h-3 w-3 mr-1" />
        Отклонить
      </Button>
    </div>
  );
}

export default BookingActionCard;
