/**
 * GoStayLo - Partner Seasonal Prices API (v2)
 * 
 * Features:
 * - GET: Fetch seasonal prices for partner's listings
 * - POST: UPSERT seasonal prices with conflict resolution
 * - DELETE: Remove seasonal price policy
 * 
 * CONFLICT LOGIC:
 * - Automatically splits/trims overlapping date ranges
 * - Ensures NO overlaps for same listing_id
 */

import { NextResponse } from 'next/server'
import { getUserIdFromSession, verifyPartnerAccess } from '@/lib/services/session-service'
import { upsertPartnerSeasonalPrice } from '@/lib/services/calendar/partner-seasonal-price.service.js'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * GET - Fetch seasonal prices for partner's listings
 */
export async function GET(request) {
  try {
    const userId = await getUserIdFromSession()
    
    if (!userId) {
      return NextResponse.json({
        status: 'error',
        error: 'Authentication required'
      }, { status: 401 })
    }
    
    const partner = await verifyPartnerAccess(userId)
    if (!partner) {
      return NextResponse.json({
        status: 'error',
        error: 'Partner access denied'
      }, { status: 403 })
    }
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json({
        status: 'success',
        data: [],
        meta: { partnerId: userId }
      })
    }
    
    const { searchParams } = new URL(request.url)
    const listingId = searchParams.get('listingId')
    
    // Fetch partner's listings
    const listingsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/listings?owner_id=eq.${userId}&select=id`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    )
    const listings = await listingsRes.json()
    
    if (!Array.isArray(listings) || listings.length === 0) {
      return NextResponse.json({
        status: 'success',
        data: [],
        meta: { partnerId: userId }
      })
    }
    
    const listingIds = listings.map(l => l.id)
    
    // Build query
    let query = `${SUPABASE_URL}/rest/v1/seasonal_prices?listing_id=in.(${listingIds.join(',')})&select=*&order=start_date.asc`
    if (listingId) {
      query = `${SUPABASE_URL}/rest/v1/seasonal_prices?listing_id=eq.${listingId}&select=*&order=start_date.asc`
    }
    
    const pricesRes = await fetch(query, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    })
    
    const prices = await pricesRes.json()
    
    return NextResponse.json({
      status: 'success',
      data: Array.isArray(prices) ? prices : [],
      meta: { partnerId: userId, count: Array.isArray(prices) ? prices.length : 0 }
    })
    
  } catch (error) {
    console.error('[SEASONAL-PRICES GET ERROR]', error)
    return NextResponse.json({
      status: 'error',
      error: error.message
    }, { status: 500 })
  }
}

/**
 * POST - UPSERT seasonal price with conflict resolution
 */
export async function POST(request) {
  try {
    const userId = await getUserIdFromSession()
    
    if (!userId) {
      return NextResponse.json({
        status: 'error',
        error: 'Authentication required'
      }, { status: 401 })
    }
    
    const partner = await verifyPartnerAccess(userId)
    if (!partner) {
      return NextResponse.json({
        status: 'error',
        error: 'Partner access denied'
      }, { status: 403 })
    }
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json({
        status: 'error',
        error: 'Supabase not configured'
      }, { status: 500 })
    }
    
    const body = await request.json()
    const { listingId, startDate, endDate, priceDaily, priceMonthly, seasonType, label, minStay } = body

    const result = await upsertPartnerSeasonalPrice({
      partnerId: userId,
      listingId,
      startDate,
      endDate,
      priceDaily,
      priceMonthly,
      seasonType,
      label,
      minStay,
    })

    if (!result.ok) {
      const status =
        result.code === 'LISTING_NOT_FOUND'
          ? 404
          : result.code === 'VALIDATION_ERROR'
            ? 400
            : 500
      return NextResponse.json({ status: 'error', error: result.error }, { status })
    }

    return NextResponse.json({
      status: 'success',
      data: result.data,
      meta: {
        partnerId: userId,
        conflictsResolved: result.conflictsResolved,
      },
    })
    
  } catch (error) {
    console.error('[SEASONAL-PRICES POST ERROR]', error)
    return NextResponse.json({
      status: 'error',
      error: error.message
    }, { status: 500 })
  }
}

/**
 * DELETE - Remove seasonal price policy
 */
export async function DELETE(request) {
  try {
    const userId = await getUserIdFromSession()
    
    if (!userId) {
      return NextResponse.json({
        status: 'error',
        error: 'Authentication required'
      }, { status: 401 })
    }
    
    const partner = await verifyPartnerAccess(userId)
    if (!partner) {
      return NextResponse.json({
        status: 'error',
        error: 'Partner access denied'
      }, { status: 403 })
    }
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json({
        status: 'error',
        error: 'Supabase not configured'
      }, { status: 500 })
    }
    
    const { searchParams } = new URL(request.url)
    const priceId = searchParams.get('id')
    
    if (!priceId) {
      return NextResponse.json({
        status: 'error',
        error: 'Missing price ID'
      }, { status: 400 })
    }
    
    // Verify ownership
    const priceRes = await fetch(
      `${SUPABASE_URL}/rest/v1/seasonal_prices?id=eq.${priceId}&select=listing_id`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    )
    const price = await priceRes.json()
    
    if (!Array.isArray(price) || price.length === 0) {
      return NextResponse.json({
        status: 'error',
        error: 'Price policy not found'
      }, { status: 404 })
    }
    
    // Verify listing ownership
    const listingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/listings?id=eq.${price[0].listing_id}&owner_id=eq.${userId}&select=id`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    )
    const listing = await listingRes.json()
    
    if (!Array.isArray(listing) || listing.length === 0) {
      return NextResponse.json({
        status: 'error',
        error: 'Access denied'
      }, { status: 403 })
    }
    
    // Delete
    await fetch(
      `${SUPABASE_URL}/rest/v1/seasonal_prices?id=eq.${priceId}`,
      {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    )

    const affectedListingId = price[0].listing_id
    try {
      await revalidateListingPaths('update', affectedListingId)
    } catch (e) {
      console.warn('[SEASONAL-PRICES] revalidate:', e?.message)
    }
    
    return NextResponse.json({
      status: 'success',
      message: 'Seasonal price deleted'
    })
    
  } catch (error) {
    console.error('[SEASONAL-PRICES DELETE ERROR]', error)
    return NextResponse.json({
      status: 'error',
      error: error.message
    }, { status: 500 })
  }
}
