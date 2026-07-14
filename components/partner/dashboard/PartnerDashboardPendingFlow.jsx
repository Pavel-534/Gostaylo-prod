'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Clock, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { PartnerBookingDetailDrawer } from '@/components/partner/bookings/PartnerBookingDetailDrawer'
import { PendingBookingCard } from '@/components/partner/dashboard/partner-dashboard-widgets'
import { usePartnerBookingDetail } from '@/hooks/use-partner-booking-detail'
import { usePartnerDashboardBookingActions } from '@/hooks/partner/use-partner-dashboard-booking-actions'
import { getUIText } from '@/lib/translations'

/**
 * Pending approvals queue + detail drawer + decline confirmation (Stage 187.0).
 */
export function PartnerDashboardPendingFlow({ pending, partnerId, language = 'ru' }) {
  const count = pending?.count ?? 0
  const items = pending?.items ?? []

  const [selectedBookingId, setSelectedBookingId] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [rejectDialog, setRejectDialog] = useState({ open: false, bookingId: null })
  const [rejectReason, setRejectReason] = useState('')

  const { handleApprove, handleDecline, isUpdatingBooking } = usePartnerDashboardBookingActions(
    partnerId,
    language,
  )

  const { booking: detailBooking, isLoading: detailLoading } = usePartnerBookingDetail(
    selectedBookingId,
    { enabled: drawerOpen && !!selectedBookingId },
  )

  const openDrawer = useCallback((bookingId) => {
    setSelectedBookingId(String(bookingId))
    setDrawerOpen(true)
  }, [])

  const handleDrawerOpenChange = useCallback((open) => {
    setDrawerOpen(open)
    if (!open) setSelectedBookingId(null)
  }, [])

  const handleConfirm = useCallback(
    async (bookingOrId) => {
      const bookingId = typeof bookingOrId === 'string' ? bookingOrId : bookingOrId?.id
      if (!bookingId) return
      await handleApprove(bookingId)
      handleDrawerOpenChange(false)
    },
    [handleApprove, handleDrawerOpenChange],
  )

  const handleRejectClick = useCallback((bookingOrId) => {
    const bookingId = typeof bookingOrId === 'string' ? bookingOrId : bookingOrId?.id
    if (!bookingId) return
    setRejectDialog({ open: true, bookingId })
    setRejectReason('')
  }, [])

  const handleRejectSubmit = useCallback(async () => {
    if (!rejectDialog.bookingId) return
    try {
      await handleDecline(rejectDialog.bookingId, rejectReason)
      setRejectDialog({ open: false, bookingId: null })
      setRejectReason('')
      handleDrawerOpenChange(false)
    } catch {
      /* toast handled in hook */
    }
  }, [handleDecline, rejectDialog.bookingId, rejectReason, handleDrawerOpenChange])

  if (count <= 0) return null

  return (
    <>
      <Card className="border-amber-300 shadow-sm ring-2 ring-amber-400/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 shrink-0 text-amber-500" aria-hidden />
                {getUIText('partnerDashboard_pendingApprovalsTitle', language)}
              </CardTitle>
              <CardDescription>{getUIText('partnerDashboard_pendingApprovalsDesc', language)}</CardDescription>
            </div>
            <Badge className="shrink-0 border-amber-200 bg-amber-100 text-amber-800 tabular-nums">
              {count}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.length > 0 ? (
            items.map((booking) => (
              <PendingBookingCard
                key={booking.id}
                booking={booking}
                onOpen={openDrawer}
                language={language}
              />
            ))
          ) : (
            <div className="py-6 text-center text-slate-500">
              <Check className="mx-auto mb-2 h-8 w-8 text-green-500" aria-hidden />
              <p>{getUIText('partnerDashboard_allProcessed', language)}</p>
            </div>
          )}

          {count > 3 ? (
            <Button variant="ghost" className="mt-2 w-full min-h-[44px]" asChild>
              <Link href="/partner/bookings">
                {getUIText('partnerDashboard_showAll', language).replace('{count}', String(count))}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <PartnerBookingDetailDrawer
        booking={detailBooking}
        open={drawerOpen && !!selectedBookingId}
        onOpenChange={handleDrawerOpenChange}
        language={language}
        isBusy={isUpdatingBooking}
        isLoading={detailLoading}
        onConfirm={handleConfirm}
        onDecline={handleRejectClick}
      />

      <Dialog
        open={rejectDialog.open}
        onOpenChange={(open) => {
          if (!open) setRejectDialog({ open: false, bookingId: null })
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getUIText('partnerBookings_rejectTitle', language)}</DialogTitle>
            <DialogDescription>{getUIText('partnerBookings_rejectDesc', language)}</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder={getUIText('partnerBookings_rejectPlaceholder', language)}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button
              variant="outline"
              className="min-h-[44px]"
              onClick={() => setRejectDialog({ open: false, bookingId: null })}
            >
              {getUIText('partnerBookings_rejectCancel', language)}
            </Button>
            <Button
              onClick={() => void handleRejectSubmit()}
              disabled={isUpdatingBooking}
              className="min-h-[44px] bg-red-600 hover:bg-red-700"
            >
              {isUpdatingBooking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {getUIText('partnerBookings_rejectSubmit', language)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
