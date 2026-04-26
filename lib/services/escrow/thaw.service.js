import { supabaseAdmin } from '@/lib/supabase'
import { NotificationService, NotificationEvents } from '../notification.service.js'
import { syncBookingStatusToConversationChat } from '@/lib/booking-status-chat-sync'
import { resolveListingCategorySlug } from '@/lib/services/booking.service'
import { computeEscrowThawAt } from '@/lib/escrow-thaw-rules.js'
import { listingDateToday, toListingDate } from '@/lib/listing-date'
import { BookingStatus } from './constants.js'
import { readBookingFinancialSnapshot } from '@/lib/services/booking-financial-read-model.service'

export async function thawBookingToThawed(bookingId) {
  const { data: booking, error: fetchError } = await supabaseAdmin
    .from('bookings')
    .select(
      `
        id,
        status,
        partner_id,
        renter_id,
        guest_name,
        metadata,
        listing:listings(id, title, category_id)
      `,
    )
    .eq('id', bookingId)
    .maybeSingle()
  if (fetchError || !booking || booking.status !== BookingStatus.PAID_ESCROW) {
    return { success: false, error: 'not_eligible' }
  }
  const now = new Date().toISOString()
  const meta = booking.metadata && typeof booking.metadata === 'object' ? booking.metadata : {}
  const { error: upErr } = await supabaseAdmin
    .from('bookings')
    .update({
      status: BookingStatus.THAWED,
      metadata: { ...meta, escrow_thawed_at: now },
    })
    .eq('id', bookingId)
  if (upErr) {
    return { success: false, error: upErr.message }
  }
  try {
    await syncBookingStatusToConversationChat({
      bookingId,
      previousStatus: BookingStatus.PAID_ESCROW,
      newStatus: BookingStatus.THAWED,
    })
  } catch (e) {
    console.error('[THAW] chat sync', e)
  }

  try {
    const { data: partnerRow, error: partnerErr } = await supabaseAdmin
      .from('profiles')
      .select('id, telegram_id, language, first_name, email')
      .eq('id', booking.partner_id)
      .maybeSingle()
    if (partnerErr || !partnerRow) {
      console.warn('[THAW] partner profile', partnerErr?.message || 'missing')
    } else {
      const fin = await readBookingFinancialSnapshot(bookingId)
      const netThbRounded =
        fin.success && fin.data?.partnerPayoutThb != null
          ? Math.round(Number(fin.data.partnerPayoutThb))
          : Math.round(Number(booking.partner_earnings_thb ?? 0))
      const fundsNetThb = String(Number.isFinite(netThbRounded) ? netThbRounded : 0)

      /** Средства: сразу при THAWED. Отзыв о клиенте — только после check_out (cron Stage 47.2). */
      await NotificationService.dispatch(NotificationEvents.PARTNER_FUNDS_THAWED_AVAILABLE, {
        booking: { ...booking, status: BookingStatus.THAWED },
        listing: booking.listing,
        partner: partnerRow,
        fundsNetThb,
      })
    }
  } catch (nErr) {
    console.error('[THAW] partner funds-thaw notify', nErr)
  }

  return { success: true }
}

export async function getUpcomingThawBookings() {
  try {
    const today = listingDateToday()

    const { data: rawRows, error } = await supabaseAdmin
      .from('bookings')
      .select(
        `
        id,
        check_in,
        price_thb,
        partner_earnings_thb,
        listing:listings(id, title, owner_id)
      `,
      )
      .eq('status', BookingStatus.PAID_ESCROW)

    if (error) {
      console.error('[THAW PREVIEW] Query error:', error)
      return { success: false, bookings: [] }
    }

    const data = (rawRows || []).filter((b) => toListingDate(b.check_in) === today)

    return { success: true, bookings: data || [] }
  } catch (error) {
    console.error('[THAW PREVIEW] Error:', error)
    return { success: false, bookings: [] }
  }
}

export async function notifyUpcomingThaw() {
  try {
    const { bookings } = await getUpcomingThawBookings()

    if (!bookings || bookings.length === 0) {
      return { success: true, message: 'No bookings to thaw tomorrow' }
    }

    await NotificationService.dispatch(NotificationEvents.ESCROW_THAW_PREVIEW, {
      bookings,
      thawDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    })

    return {
      success: true,
      count: bookings.length,
      bookings: bookings.map((b) => ({
        id: b.id,
        listing: b.listing?.title,
        amount: b.partner_earnings_thb,
      })),
    }
  } catch (error) {
    console.error('[THAW PREVIEW] Error:', error)
    return { success: false, error: error.message }
  }
}

export async function backfillMissingEscrowThawAt(limit = 300) {
  const { data: rows, error } = await supabaseAdmin
    .from('bookings')
    .select('id, check_in, metadata, listing:listings(category_id)')
    .eq('status', BookingStatus.PAID_ESCROW)
    .is('escrow_thaw_at', null)
    .limit(limit)
  if (error || !rows?.length) return { updated: 0 }
  let updated = 0
  for (const b of rows) {
    const slug = await resolveListingCategorySlug(b.listing?.category_id)
    const escrowAt = (b.metadata && b.metadata.escrow_started) || new Date().toISOString()
    const thawAt = computeEscrowThawAt({
      checkInRaw: b.check_in,
      categorySlug: slug,
      escrowAtIso: typeof escrowAt === 'string' ? escrowAt : new Date().toISOString(),
    })
    const { error: u } = await supabaseAdmin
      .from('bookings')
      .update({ escrow_thaw_at: thawAt })
      .eq('id', b.id)
    if (!u) updated += 1
    else console.warn('[backfill escrow_thaw_at]', b.id, u.message)
  }
  return { updated }
}
