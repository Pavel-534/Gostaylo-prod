/**
 * POST /api/v2/bookings/[id]/emergency-support-ticket
 * Stage 23.0: renter hit EMERGENCY_RATE_LIMIT — staff context in booking chat (hidden from host) + staff pulse.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSessionPayload, getUserIdFromSession } from '@/lib/services/session-service'
import { ensureBookingConversation } from '@/lib/services/booking.service'
import { PushService } from '@/lib/services/push.service'
import { sendMessage } from '@/lib/telegram'
import { getPublicSiteUrl } from '@/lib/site-url.js'
import { formatPrivacyDisplayNameForParticipant } from '@/lib/utils/name-formatter'
import { effectiveRoleFromProfile } from '@/lib/services/chat/access'
import { formatEmergencyChecklistRu } from '@/lib/emergency-contact-admin-notify'
import { canRenterUseEmergencyContactBooking } from '@/lib/emergency-contact-eligibility'

export const dynamic = 'force-dynamic'

const DEDUP_MS = 2 * 60 * 60 * 1000

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function lastEmergencyEventFromMeta(metadata) {
  const m = metadata && typeof metadata === 'object' ? metadata : {}
  const ev = Array.isArray(m.emergency_contact_events) ? m.emergency_contact_events : []
  if (!ev.length) return null
  const sorted = [...ev].sort((a, b) => {
    const ta = new Date(String(a?.at || 0)).getTime()
    const tb = new Date(String(b?.at || 0)).getTime()
    return tb - ta
  })
  return sorted[0] || null
}

async function notifySupportTelegramThread({ conversationId, bookingId, renterLabel }) {
  const adminGroupId = process.env.TELEGRAM_ADMIN_GROUP_ID
  const rawTopic = process.env.TELEGRAM_SUPPORT_TOPIC_ID
  if (!adminGroupId || !process.env.TELEGRAM_BOT_TOKEN) return
  let threadId = 232
  if (rawTopic != null && String(rawTopic).trim() !== '') {
    const parsed = parseInt(String(rawTopic).trim(), 10)
    if (Number.isFinite(parsed) && parsed > 0) threadId = parsed
  }
  const base = (getPublicSiteUrl() || '').replace(/\/$/, '')
  const adminMessages = `${base}/admin/messages/?open=${encodeURIComponent(conversationId)}`
  const audit = `${base}/admin/bookings/${encodeURIComponent(String(bookingId))}`
  const text =
    `🆘 <b>Эскалация: лимит экстренной связи</b>\n\n` +
    `<b>Бронь:</b> <code>${escHtml(bookingId)}</code>\n` +
    `<b>Гость:</b> ${escHtml(renterLabel)}\n` +
    `<a href="${adminMessages}">Чат в админке</a> · <a href="${audit}">Аудит брони</a>`
  const tg = await sendMessage(adminGroupId, text, {
    message_thread_id: threadId,
    disable_web_page_preview: true,
  })
  if (!tg?.ok) {
    console.warn('[emergency-support-ticket] Telegram failed:', tg?.description || tg?.error)
  }
}

export async function POST(request, { params }) {
  try {
    const userId = await getUserIdFromSession()
    if (!userId || !supabaseAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    let body = {}
    try {
      const text = await request.text()
      if (text && text.trim()) body = JSON.parse(text)
    } catch {
      body = {}
    }

    const bookingId = String(params?.id || '').trim()
    if (!bookingId) {
      return NextResponse.json({ success: false, error: 'Invalid booking' }, { status: 400 })
    }

    const session = await getSessionPayload()
    if (session?.role && ['ADMIN', 'MODERATOR'].includes(String(session.role).toUpperCase())) {
      return NextResponse.json({ success: false, error: 'Staff should use admin tools' }, { status: 403 })
    }

    const { data: booking, error: bErr } = await supabaseAdmin
      .from('bookings')
      .select(
        'id, renter_id, partner_id, listing_id, status, check_in, check_out, price_thb, guest_name, metadata',
      )
      .eq('id', bookingId)
      .maybeSingle()

    if (bErr || !booking || String(booking.renter_id) !== String(userId)) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 })
    }

    const life = canRenterUseEmergencyContactBooking({
      status: booking.status,
      checkOutIso: booking.check_out,
    })
    if (!life.allowed) {
      return NextResponse.json({ success: false, error: 'Emergency support not available for this booking' }, { status: 403 })
    }

    if (!booking.listing_id || !booking.partner_id) {
      return NextResponse.json({ success: false, error: 'Booking missing listing or partner' }, { status: 400 })
    }

    const { data: listing, error: lErr } = await supabaseAdmin
      .from('listings')
      .select('id, title, category_id, owner_id, base_price_thb')
      .eq('id', String(booking.listing_id))
      .maybeSingle()

    if (lErr || !listing || String(listing.owner_id) !== String(booking.partner_id)) {
      return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 })
    }

    let conversationId = null
    const { data: convRow } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .eq('booking_id', bookingId)
      .limit(1)
      .maybeSingle()

    if (convRow?.id) {
      conversationId = String(convRow.id)
    } else {
      const ensured = await ensureBookingConversation({
        bookingId,
        listingId: String(booking.listing_id),
        listing,
        renterId: String(userId),
        partnerId: String(booking.partner_id),
        guestName: booking.guest_name || null,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        priceThb: booking.price_thb != null ? Number(booking.price_thb) : Number(listing.base_price_thb) || null,
        pricingSnapshot: null,
      })
      if (!ensured) {
        return NextResponse.json(
          { success: false, error: 'Could not open booking conversation' },
          { status: 500 },
        )
      }
      conversationId = String(ensured)
    }

    const nowMs = Date.now()
    const { data: recentMsgs } = await supabaseAdmin
      .from('messages')
      .select('id, metadata, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(20)

    for (const row of recentMsgs || []) {
      const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}
      if (meta.system_key !== 'emergency_rate_limit_context') continue
      if (String(meta.emergency_support_context?.booking_id || '') !== bookingId) continue
      const t = row?.created_at ? new Date(String(row.created_at)).getTime() : NaN
      if (Number.isFinite(t) && nowMs - t < DEDUP_MS) {
        return NextResponse.json({
          success: true,
          data: { conversationId, alreadyNotified: true },
        })
      }
    }

    const profile = await supabaseAdmin
      .from('profiles')
      .select('id,first_name,last_name,email,role')
      .eq('id', userId)
      .maybeSingle()
    const p = profile?.data
    const senderRole = effectiveRoleFromProfile(p)
    const senderName = formatPrivacyDisplayNameForParticipant(p?.first_name, p?.last_name, p?.email, 'Guest')

    const lastEv = lastEmergencyEventFromMeta(booking.metadata)
    const checklist = lastEv?.checklist && typeof lastEv.checklist === 'object' ? lastEv.checklist : {}
    const checklistSummary = formatEmergencyChecklistRu(checklist)
    const lastEmergencyAt = lastEv?.at ? String(lastEv.at) : null

    const staffDetail = [
      '[Staff] EMERGENCY_RATE_LIMIT',
      `booking_id=${bookingId}`,
      `last_emergency_at=${lastEmergencyAt || '—'}`,
      `checklist_guest=${checklistSummary}`,
    ].join('\n')

    const guestFacingRu =
      'Служба поддержки получила контекст по этой брони (лимит экстренной связи). Специалист увидит детали в треде.'
    const guestFacingEn =
      'Support has been given context for this booking (emergency contact rate limit). A specialist will review the thread.'

    const lang = typeof body?.lang === 'string' && body.lang.toLowerCase().startsWith('en') ? 'en' : 'ru'
    const visibleLine = lang === 'en' ? guestFacingEn : guestFacingRu

    const messageId = `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    const nowIso = new Date().toISOString()

    const { error: insErr } = await supabaseAdmin.from('messages').insert({
      id: messageId,
      conversation_id: conversationId,
      sender_id: userId,
      sender_role: senderRole,
      sender_name: senderName,
      message: visibleLine,
      content: visibleLine,
      type: 'text',
      metadata: {
        system_key: 'emergency_rate_limit_context',
        hidden_from_recipient: true,
        emergency_support_context: {
          booking_id: bookingId,
          code: 'EMERGENCY_RATE_LIMIT',
          checklist_summary_ru: checklistSummary,
          last_emergency_at: lastEmergencyAt,
          staff_detail: staffDetail,
        },
      },
      is_read: false,
      created_at: nowIso,
    })

    if (insErr) {
      console.error('[emergency-support-ticket] insert', insErr)
      return NextResponse.json({ success: false, error: insErr.message }, { status: 500 })
    }

    await supabaseAdmin
      .from('conversations')
      .update({ is_priority: true, updated_at: nowIso, last_message_at: nowIso })
      .eq('id', conversationId)

    await PushService.notifyStaffSupportEscalation(conversationId)
    void notifySupportTelegramThread({
      conversationId,
      bookingId,
      renterLabel: senderName,
    }).catch((e) => console.error('[emergency-support-ticket] tg', e?.message || e))

    return NextResponse.json({
      success: true,
      data: { conversationId, messageId, alreadyNotified: false },
    })
  } catch (e) {
    console.error('[emergency-support-ticket]', e)
    return NextResponse.json({ success: false, error: e?.message || 'error' }, { status: 500 })
  }
}
