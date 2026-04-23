/**
 * POST /api/v2/admin/bookings/[id]/emergency-actions — mark abuse on log entry or set 24h rate-limit exempt (ADMIN).
 * Body: { action: 'mark_abuse', at: '<iso matching event.at>' } | { action: 'rate_limit_exempt', value: boolean }
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveAdminSecurityProfile } from '@/lib/admin-security-access'

export const dynamic = 'force-dynamic'

export async function POST(request, { params }) {
  const session = await resolveAdminSecurityProfile()
  if (session.error) {
    return NextResponse.json(
      { success: false, error: session.error.message },
      { status: session.error.status },
    )
  }

  const adminId = session.profile.id
  const bookingId = String(params?.id || '').trim()
  if (!bookingId || !supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'Invalid booking id' }, { status: 400 })
  }

  let body = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const action = String(body.action || '').trim()
  const { data: booking, error: bErr } = await supabaseAdmin
    .from('bookings')
    .select('id, metadata')
    .eq('id', bookingId)
    .maybeSingle()

  if (bErr || !booking) {
    return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 })
  }

  const prevMeta = booking.metadata && typeof booking.metadata === 'object' ? { ...booking.metadata } : {}
  const events = Array.isArray(prevMeta.emergency_contact_events) ? [...prevMeta.emergency_contact_events] : []

  if (action === 'rate_limit_exempt') {
    const value = body.value === true
    const nextMeta = { ...prevMeta, emergency_contact_rate_limit_exempt: value }
    const { error: upErr } = await supabaseAdmin
      .from('bookings')
      .update({ metadata: nextMeta, updated_at: new Date().toISOString() })
      .eq('id', bookingId)
    if (upErr) {
      return NextResponse.json({ success: false, error: upErr.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: { emergency_contact_rate_limit_exempt: value } })
  }

  if (action === 'mark_abuse') {
    const at = String(body.at || '').trim()
    if (!at) {
      return NextResponse.json({ success: false, error: 'at is required' }, { status: 400 })
    }
    const nowIso = new Date().toISOString()
    let found = false
    const nextEvents = events.map((ev) => {
      if (!ev || typeof ev !== 'object') return ev
      if (String(ev.at || '') !== at) return ev
      found = true
      return {
        ...ev,
        abuse: {
          marked: true,
          marked_at: nowIso,
          marked_by: String(adminId),
        },
      }
    })

    if (!found) {
      return NextResponse.json({ success: false, error: 'Event not found for given at' }, { status: 404 })
    }

    const nextMeta = { ...prevMeta, emergency_contact_events: nextEvents }
    const { error: upErr } = await supabaseAdmin
      .from('bookings')
      .update({ metadata: nextMeta, updated_at: nowIso })
      .eq('id', bookingId)
    if (upErr) {
      return NextResponse.json({ success: false, error: upErr.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
}
