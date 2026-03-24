/**
 * Опционально: Supabase Database Webhook на таблицу `bookings` (UPDATE),
 * чтобы системные сообщения в чате появлялись даже при смене статуса вне Next.js
 * (SQL, другой сервис). Включите «Старые записи» (old_record) в настройках вебхука.
 *
 * Заголовок: x-booking-chat-secret: <BOOKING_STATUS_WEBHOOK_SECRET>
 * Тело: { record, old_record } как в Supabase Database Webhooks.
 */

import { NextResponse } from 'next/server'
import { syncBookingStatusToConversationChat } from '@/lib/booking-status-chat-sync'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const expected = process.env.BOOKING_STATUS_WEBHOOK_SECRET
  if (!expected) {
    return NextResponse.json({ ok: false, error: 'BOOKING_STATUS_WEBHOOK_SECRET not set' }, { status: 503 })
  }

  const secret = request.headers.get('x-booking-chat-secret')
  if (secret !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  try {
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
    }

    const record = body.record || body.new
    const oldRecord = body.old_record || body.old || {}
    const bookingId = record?.id
    const newStatus = record?.status
    const previousStatus = oldRecord?.status

    if (!bookingId || !newStatus) {
      return NextResponse.json({ ok: false, error: 'Missing id or status' }, { status: 400 })
    }

    if (previousStatus === undefined || previousStatus === null) {
      return NextResponse.json({
        ok: true,
        skipped: 'need_old_record',
        hint: 'Enable “old record” on the Supabase Database Webhook for bookings',
      })
    }

    if (String(previousStatus) === String(newStatus)) {
      return NextResponse.json({ ok: true, skipped: 'same_status' })
    }

    const result = await syncBookingStatusToConversationChat({
      bookingId,
      previousStatus: previousStatus ?? '',
      newStatus,
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error('[webhook booking-status]', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
