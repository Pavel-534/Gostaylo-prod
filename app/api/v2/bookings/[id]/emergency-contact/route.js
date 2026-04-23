/**
 * POST /api/v2/bookings/[id]/emergency-contact — Stage 21–22: renter → partner (bypass quiet hours) + checklist + rate limit.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserIdFromSession } from '@/lib/services/session-service'
import { PushService } from '@/lib/services/push.service'
import { getPublicSiteUrl } from '@/lib/site-url.js'
import { AvailabilityService } from '@/lib/services/availability.service'
import {
  parseEmergencyChecklistFromBody,
  hasEmergencyContactWithinWindow,
  isEmergencyRateLimitExempt,
} from '@/lib/emergency-contact-protocol'
import { notifyAdminEmergencyTelegram } from '@/lib/emergency-contact-admin-notify'
import { sendEmergencySMS } from '@/lib/services/emergency-contact-protocol'

export const dynamic = 'force-dynamic'

export async function POST(request, { params }) {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const bookingId = String(params?.id || '').trim()
    if (!bookingId || !supabaseAdmin) {
      return NextResponse.json({ success: false, error: 'Invalid booking' }, { status: 400 })
    }

    let body = {}
    try {
      const text = await request.text()
      if (text && text.trim()) body = JSON.parse(text)
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = parseEmergencyChecklistFromBody(body)
    if (!parsed.ok) {
      return NextResponse.json({ success: false, error: parsed.error, code: 'INVALID_CHECKLIST' }, { status: 400 })
    }
    const { checklist } = parsed

    const { data: booking, error: bErr } = await supabaseAdmin
      .from('bookings')
      .select('id, renter_id, partner_id, listing_id, status, check_in, check_out, metadata')
      .eq('id', bookingId)
      .maybeSingle()

    if (bErr || !booking) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 })
    }

    const allowed = AvailabilityService.isEmergencyBypassAllowed({
      actorRole: 'renter',
      userId,
      booking,
    })
    if (!allowed) {
      return NextResponse.json({ success: false, error: 'Emergency contact not allowed', code: 'FORBIDDEN' }, { status: 403 })
    }

    const prevMeta = booking.metadata && typeof booking.metadata === 'object' ? { ...booking.metadata } : {}
    const events = Array.isArray(prevMeta.emergency_contact_events) ? [...prevMeta.emergency_contact_events] : []

    if (!isEmergencyRateLimitExempt(prevMeta) && hasEmergencyContactWithinWindow(events)) {
      return NextResponse.json(
        {
          success: false,
          code: 'EMERGENCY_RATE_LIMIT',
          error: 'RATE_LIMIT',
        },
        { status: 429 },
      )
    }

    const partnerId = booking.partner_id ? String(booking.partner_id) : ''
    if (!partnerId) {
      return NextResponse.json({ success: false, error: 'No partner on booking' }, { status: 400 })
    }

    let listingTitle = 'Listing'
    if (booking.listing_id) {
      const { data: listingRow } = await supabaseAdmin
        .from('listings')
        .select('title')
        .eq('id', String(booking.listing_id))
        .maybeSingle()
      if (listingRow?.title) listingTitle = String(listingRow.title)
    }

    const base = (getPublicSiteUrl() || '').replace(/\/$/, '')
    const link = `${base}/partner/bookings?booking=${encodeURIComponent(bookingId)}`

    const pushResult = await PushService.sendToUser(partnerId, 'RENTER_EMERGENCY_CONTACT', {
      listing: String(listingTitle),
      link,
      bookingId,
      listingId: booking.listing_id ? String(booking.listing_id) : undefined,
      emergencyBypass: true,
    })

    const at = new Date().toISOString()
    const pushDelivery = {
      success: Boolean(pushResult?.success),
      sent: Number(pushResult?.sent ?? 0),
      failed: Number(pushResult?.failed ?? 0),
      skipped: Boolean(pushResult?.skipped),
      error: pushResult?.error ? String(pushResult.error) : null,
    }

    events.push({
      at,
      actor_id: String(userId),
      source: 'unified_order_card',
      checklist,
      push: pushDelivery,
      abuse: { marked: false, marked_at: null, marked_by: null },
    })

    const nextMeta = { ...prevMeta, emergency_contact_events: events }

    const { error: metaErr } = await supabaseAdmin
      .from('bookings')
      .update({ metadata: nextMeta, updated_at: at })
      .eq('id', bookingId)

    if (metaErr) {
      console.error('[emergency-contact] metadata update', metaErr)
      return NextResponse.json({ success: false, error: metaErr.message }, { status: 500 })
    }

    void notifyAdminEmergencyTelegram({
      bookingId,
      listingTitle: String(listingTitle),
      checklist,
    }).catch((err) => console.error('[emergency-contact] admin telegram', err?.message || err))

    if (checklist.health_or_safety === true) {
      const { data: partnerRow } = await supabaseAdmin
        .from('profiles')
        .select('phone')
        .eq('id', partnerId)
        .maybeSingle()
      sendEmergencySMS({
        partnerPhone: partnerRow?.phone != null ? String(partnerRow.phone) : null,
      })
    }

    return NextResponse.json({ success: true, push: pushDelivery })
  } catch (e) {
    console.error('[emergency-contact]', e)
    return NextResponse.json({ success: false, error: e?.message || 'error' }, { status: 500 })
  }
}
