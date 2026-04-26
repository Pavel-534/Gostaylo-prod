/**
 * GoStayLo - Partner Bookings API (v2)
 * 
 * SECURITY: All queries filtered by owner_id = session.user.id
 * Response Format: { status: 'success', data: [...], meta: { total: 0 } }
 * 
 * GET /api/v2/partner/bookings - Get partner's bookings (filtered by owner_id)
 * PUT /api/v2/partner/bookings - Update booking status
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import { getUserIdFromSession, verifyPartnerAccess } from '@/lib/services/session-service'
import { resolveDefaultCommissionPercent } from '@/lib/services/currency.service'
import { attachPartnerTrustToBookings } from '@/lib/booking/attach-partner-trust-to-bookings'
import { buildBookingFinancialSnapshotFromRow } from '@/lib/services/booking-financial-read-model.service'
import { transformPartnerBookingToClient } from '@/lib/partner/partner-booking-transform'

export const dynamic = 'force-dynamic'

// Mock bookings for development without Supabase (removed hardcoded IDs)
const mockBookings = [
  {
    id: 'booking-1',
    listing_id: 'lst-001',
    renter_id: 'user-test-renter',
    partner_id: 'partner-1', // Use this ID when testing with mock data
    status: 'PENDING',
    check_in: '2026-03-20',
    check_out: '2026-03-25',
    price_thb: 25000,
    commission_rate: 15,
    commission_thb: 3750,
    partner_earnings_thb: 21250,
    guest_name: 'Иван Петров',
    guest_phone: '+7 999 123 4567',
    guest_email: 'ivan@example.com',
    special_requests: 'Ранний заезд если возможно',
    created_at: '2026-03-10T10:00:00Z',
    metadata: { listing_category_slug: 'property' },
    listing: {
      id: 'lst-001',
      title: 'Роскошная вилла с бассейном',
      district: 'Rawai',
      images: ['https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=400']
    }
  },
  {
    id: 'booking-2',
    listing_id: 'lst-002',
    renter_id: 'user-test-renter-2',
    partner_id: 'partner-1',
    status: 'CONFIRMED',
    check_in: '2026-03-15',
    check_out: '2026-03-18',
    price_thb: 15000,
    commission_rate: 15,
    commission_thb: 2250,
    partner_earnings_thb: 12750,
    guest_name: 'Мария Сидорова',
    guest_phone: '+7 999 765 4321',
    guest_email: 'maria@example.com',
    special_requests: null,
    created_at: '2026-03-08T14:30:00Z',
    metadata: { listing_category_slug: 'vehicles' },
    listing: {
      id: 'lst-002',
      title: 'Современные апартаменты в центре',
      district: 'Patong',
      images: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400']
    }
  },
  {
    id: 'booking-3',
    listing_id: 'lst-001',
    renter_id: 'renter-3',
    partner_id: 'partner-1',
    status: 'COMPLETED',
    check_in: '2026-03-01',
    check_out: '2026-03-05',
    price_thb: 20000,
    commission_rate: 12,
    commission_thb: 2400,
    partner_earnings_thb: 17600,
    guest_name: 'Алексей Козлов',
    guest_phone: '+7 999 111 2233',
    guest_email: 'alex@example.com',
    special_requests: 'Трансфер из аэропорта',
    confirmed_at: '2026-02-28T12:00:00Z',
    completed_at: '2026-03-05T11:00:00Z',
    created_at: '2026-02-25T09:15:00Z',
    metadata: { listing_category_slug: 'tours' },
    listing: {
      id: 'lst-001',
      title: 'Роскошная вилла с бассейном',
      district: 'Rawai',
      images: ['https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=400']
    }
  }
]

export async function GET(request) {
  try {
    // 1. Extract user ID from session (secure - cannot be spoofed)
    const userId = await getUserIdFromSession()
    
    if (!userId) {
      return NextResponse.json({
        status: 'error',
        error: 'Authentication required. Please log in.',
        meta: { total: 0 }
      }, { status: 401 })
    }
    
    // 2. Verify partner access
    const partner = await verifyPartnerAccess(userId)
    
    if (!partner) {
      return NextResponse.json({
        status: 'error',
        error: 'Partner access denied',
        meta: { total: 0 }
      }, { status: 403 })
    }
    
    console.log(`[PARTNER BOOKINGS] Fetching bookings for partner: ${userId}`)
    
    // 3. Parse query params
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // Filter by status
    const limit = parseInt(searchParams.get('limit')) || 50
    const offset = parseInt(searchParams.get('offset')) || 0
    
    // 4. Check if Supabase is configured
    if (!isSupabaseConfigured() || !supabaseAdmin) {
      console.log('[PARTNER BOOKINGS] Using mock data (Supabase not configured)')
      
      // Filter mock data by partner_id (SECURITY: owner_id check)
      let filtered = mockBookings.filter(b => b.partner_id === userId)
      
      // Apply status filter
      if (status && status !== 'all') {
        filtered = filtered.filter(b => b.status === status)
      }
      
      // Transform to camelCase
      const dc = await resolveDefaultCommissionPercent()
      let transformed = filtered.map((b) => ({
        ...transformPartnerBookingToClient(b, dc),
        financial_snapshot: buildBookingFinancialSnapshotFromRow(b),
      }))
      transformed = await enrichPartnerBookingsWithGuestStats(supabaseAdmin, userId, transformed)
      transformed = await enrichPartnerBookingsWithConversationIds(supabaseAdmin, transformed)
      transformed = await attachPartnerTrustToBookings(transformed)

      return NextResponse.json({
        status: 'success',
        data: transformed.slice(offset, offset + limit),
        meta: {
          total: filtered.length,
          limit,
          offset,
          partnerId: userId
        }
      })
    }
    
    // 5. Build Supabase query with SECURITY filter
    let query = supabaseAdmin
      .from('bookings')
      .select(`
        *,
        listing:listings (
          id,
          title,
          district,
          images,
          cover_image,
          base_price_thb,
          commission_rate,
          metadata,
          category_id,
          categories ( slug )
        ),
        renter:profiles!renter_id (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('partner_id', userId) // SECURITY: Filter by owner_id
      .order('created_at', { ascending: false })
    
    // Apply status filter
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }
    
    // Apply pagination
    query = query.range(offset, offset + limit - 1)
    
    const { data: bookings, error, count } = await query
    
    if (error) {
      console.error('[PARTNER BOOKINGS] Query error:', error)
      return NextResponse.json({
        status: 'error',
        error: error.message,
        meta: { total: 0 }
      }, { status: 500 })
    }
    
    // 6. Transform to camelCase + guest rating / pending guest review
    const dc = await resolveDefaultCommissionPercent()
    let transformed = (bookings || []).map((b) => ({
      ...transformPartnerBookingToClient(b, dc),
      financial_snapshot: buildBookingFinancialSnapshotFromRow(b),
    }))
    transformed = await enrichPartnerBookingsWithGuestStats(supabaseAdmin, userId, transformed)
    transformed = await enrichPartnerBookingsWithConversationIds(supabaseAdmin, transformed)
    transformed = await attachPartnerTrustToBookings(transformed)

    console.log(`[PARTNER BOOKINGS] Found ${transformed.length} bookings for partner ${userId}`)
    
    return NextResponse.json({
      status: 'success',
      data: transformed,
      meta: {
        total: count || transformed.length,
        limit,
        offset,
        partnerId: userId
      }
    })
    
  } catch (error) {
    console.error('[PARTNER BOOKINGS GET ERROR]', error)
    return NextResponse.json({
      status: 'error',
      error: error.message,
      meta: { total: 0 }
    }, { status: 500 })
  }
}

/**
 * AVG(rating) and count from guest_reviews for guests; flag bookings still needing partner review.
 */
async function enrichPartnerBookingsWithGuestStats(admin, partnerId, rows) {
  if (!rows?.length) return rows
  if (!admin) {
    return rows.map((b) => ({
      ...b,
      guestRatingAverage: null,
      guestReviewCount: 0,
      canSubmitGuestReview: false,
    }))
  }
  const bookingIds = rows.map((r) => r.id)
  const renterIds = [...new Set(rows.map((r) => r.renterId).filter(Boolean))]
  const [ratingRes, reviewedRes] = await Promise.all([
    renterIds.length
      ? admin.from('guest_reviews').select('guest_id, rating').in('guest_id', renterIds)
      : Promise.resolve({ data: [] }),
    bookingIds.length
      ? admin
          .from('guest_reviews')
          .select('booking_id')
          .eq('author_id', partnerId)
          .in('booking_id', bookingIds)
      : Promise.resolve({ data: [] }),
  ])
  const agg = {}
  for (const row of ratingRes.data || []) {
    const g = row.guest_id
    if (!g) continue
    if (!agg[g]) agg[g] = { sum: 0, n: 0 }
    agg[g].sum += Number(row.rating) || 0
    agg[g].n += 1
  }
  const reviewed = new Set((reviewedRes.data || []).map((r) => r.booking_id))
  return rows.map((b) => {
    const g = b.renterId
    const a = g ? agg[g] : null
    const avg = a && a.n > 0 ? Math.round((a.sum / a.n) * 10) / 10 : null
    return {
      ...b,
      guestRatingAverage: avg,
      guestReviewCount: a?.n ?? 0,
      canSubmitGuestReview:
        (b.status === 'THAWED' || b.status === 'COMPLETED') && !!g && !reviewed.has(b.id),
    }
  })
}

/** Link partner list cards to unified chat thread. */
async function enrichPartnerBookingsWithConversationIds(admin, rows) {
  if (!rows?.length) return rows
  if (!admin) {
    return rows.map((b) => ({ ...b, conversationId: null }))
  }
  const ids = rows.map((r) => r.id).filter(Boolean)
  if (!ids.length) return rows
  const { data, error } = await admin.from('conversations').select('id, booking_id').in('booking_id', ids)
  if (error) {
    console.warn('[PARTNER BOOKINGS] conversation lookup', error.message)
    return rows.map((b) => ({ ...b, conversationId: null }))
  }
  const firstByBooking = {}
  for (const row of data || []) {
    const bid = row.booking_id
    if (bid && firstByBooking[bid] == null) firstByBooking[bid] = row.id
  }
  return rows.map((b) => ({ ...b, conversationId: firstByBooking[b.id] || null }))
}

