import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSessionPayload } from '@/lib/services/session-service'

export const dynamic = 'force-dynamic'

function normalizePath(parts) {
  if (!Array.isArray(parts) || !parts.length) return ''
  return parts.map((x) => String(x || '').trim()).filter(Boolean).join('/')
}

function extractBookingIdFromPath(path) {
  const [first] = String(path || '').split('/')
  const match = first?.match(/^booking-([a-zA-Z0-9_-]+)$/)
  return match ? String(match[1]) : ''
}

async function canReadDisputeEvidence(session, bookingId) {
  if (!session?.userId || !bookingId) return false
  const role = String(session.role || '').toUpperCase()
  if (role === 'ADMIN' || role === 'MODERATOR') return true
  const { data: booking } = await supabaseAdmin
    .from('bookings')
    .select('id, renter_id, partner_id')
    .eq('id', bookingId)
    .maybeSingle()
  if (!booking) return false
  const uid = String(session.userId)
  return String(booking.renter_id || '') === uid || String(booking.partner_id || '') === uid
}

export async function GET(_request, { params }) {
  try {
    const objectPath = normalizePath(params?.path)
    if (!objectPath) {
      return NextResponse.json({ success: false, error: 'Missing storage path' }, { status: 400 })
    }
    const bookingId = extractBookingIdFromPath(objectPath)
    if (!bookingId) {
      return NextResponse.json({ success: false, error: 'Malformed dispute evidence path' }, { status: 400 })
    }
    const session = await getSessionPayload()
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const allowed = await canReadDisputeEvidence(session, bookingId)
    if (!allowed) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }
    const { data, error } = await supabaseAdmin.storage.from('dispute-evidence').createSignedUrl(objectPath, 60 * 10)
    if (error || !data?.signedUrl) {
      return NextResponse.json({ success: false, error: error?.message || 'Failed to sign URL' }, { status: 500 })
    }
    return NextResponse.redirect(data.signedUrl, { status: 302 })
  } catch (error) {
    return NextResponse.json({ success: false, error: error?.message || 'Internal error' }, { status: 500 })
  }
}

