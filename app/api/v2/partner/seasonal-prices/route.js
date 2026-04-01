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
import { parseISO, format, isBefore, isAfter, isSameDay, addDays, subDays } from 'date-fns'
import { revalidateListingPaths } from '@/lib/revalidation'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * Conflict Resolution Logic
 * Handles overlapping date ranges by splitting/trimming existing ranges
 */
async function resolveConflicts(listingId, newStart, newEnd) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase not configured')
  }
  
  const newStartDate = parseISO(newStart)
  const newEndDate = parseISO(newEnd)
  
  // Fetch all overlapping ranges
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/seasonal_prices?listing_id=eq.${listingId}&or=(and(start_date.lte.${newEnd},end_date.gte.${newStart}))&select=*`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    }
  )
  
  const overlapping = await res.json()
  
  if (!Array.isArray(overlapping) || overlapping.length === 0) {
    // No conflicts
    return { toDelete: [], toUpdate: [] }
  }
  
  const toDelete = []
  const toUpdate = []
  
  for (const existing of overlapping) {
    const existingStart = parseISO(existing.start_date)
    const existingEnd = parseISO(existing.end_date)
    
    // Case 1: New range completely contains existing → DELETE existing
    if (
      (isSameDay(newStartDate, existingStart) || isBefore(newStartDate, existingStart)) &&
      (isSameDay(newEndDate, existingEnd) || isAfter(newEndDate, existingEnd))
    ) {
      toDelete.push(existing.id)
    }
    // Case 2: Existing range completely contains new → SPLIT existing into two parts
    else if (
      isBefore(existingStart, newStartDate) &&
      isAfter(existingEnd, newEndDate)
    ) {
      // Keep left part
      toUpdate.push({
        id: existing.id,
        start_date: format(existingStart, 'yyyy-MM-dd'),
        end_date: format(subDays(newStartDate, 1), 'yyyy-MM-dd'),
        listing_id: existing.listing_id,
        price_daily: existing.price_daily,
        season_type: existing.season_type,
        label: existing.label,
        min_stay: existing.min_stay || 1
      })
      
      // Create right part as new entry (will be handled by caller)
      // We'll return it in a special array
    }
    // Case 3: Partial overlap on left → TRIM existing end_date
    else if (
      isBefore(existingStart, newStartDate) &&
      isAfter(existingEnd, newStartDate) &&
      !isAfter(existingEnd, newEndDate)
    ) {
      toUpdate.push({
        id: existing.id,
        start_date: format(existingStart, 'yyyy-MM-dd'),
        end_date: format(subDays(newStartDate, 1), 'yyyy-MM-dd'),
        listing_id: existing.listing_id,
        price_daily: existing.price_daily,
        season_type: existing.season_type,
        label: existing.label,
        min_stay: existing.min_stay || 1
      })
    }
    // Case 4: Partial overlap on right → TRIM existing start_date
    else if (
      isBefore(newStartDate, existingStart) &&
      isBefore(existingStart, newEndDate) &&
      isAfter(existingEnd, newEndDate)
    ) {
      toUpdate.push({
        id: existing.id,
        start_date: format(addDays(newEndDate, 1), 'yyyy-MM-dd'),
        end_date: format(existingEnd, 'yyyy-MM-dd'),
        listing_id: existing.listing_id,
        price_daily: existing.price_daily,
        season_type: existing.season_type,
        label: existing.label,
        min_stay: existing.min_stay || 1
      })
    }
  }
  
  return { toDelete, toUpdate, overlapping }
}

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
    
    // Validation
    if (!listingId || !startDate || !endDate || !priceDaily) {
      return NextResponse.json({
        status: 'error',
        error: 'Missing required fields: listingId, startDate, endDate, priceDaily'
      }, { status: 400 })
    }
    
    // Verify listing ownership
    const listingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}&owner_id=eq.${userId}&select=id`,
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
        error: 'Listing not found or access denied'
      }, { status: 404 })
    }
    
    console.log(`[SEASONAL-PRICES] Upserting for listing ${listingId}: ${startDate} to ${endDate}`)
    
    // Step 1: Resolve conflicts
    const { toDelete, toUpdate } = await resolveConflicts(listingId, startDate, endDate)
    
    console.log(`[SEASONAL-PRICES] Conflicts: ${toDelete.length} to delete, ${toUpdate.length} to update`)
    
    // Step 2: Delete fully overlapped ranges
    if (toDelete.length > 0) {
      for (const id of toDelete) {
        await fetch(
          `${SUPABASE_URL}/rest/v1/seasonal_prices?id=eq.${id}`,
          {
            method: 'DELETE',
            headers: {
              'apikey': SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
            }
          }
        )
      }
    }
    
    // Step 3: Update partially overlapped ranges (trim)
    if (toUpdate.length > 0) {
      for (const update of toUpdate) {
        await fetch(
          `${SUPABASE_URL}/rest/v1/seasonal_prices?id=eq.${update.id}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
              start_date: update.start_date,
              end_date: update.end_date
            })
          }
        )
      }
    }
    
    // Step 4: Insert new range
    const newPrice = {
      listing_id: listingId,
      start_date: startDate,
      end_date: endDate,
      price_daily: parseFloat(priceDaily),
      price_monthly: priceMonthly != null && priceMonthly !== '' ? parseFloat(priceMonthly) : null,
      season_type: seasonType || 'NORMAL',
      label: label || null,
      min_stay: minStay ? parseInt(minStay) : 1
    }
    
    const insertRes = await fetch(
      `${SUPABASE_URL}/rest/v1/seasonal_prices`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(newPrice)
      }
    )
    
    if (!insertRes.ok) {
      const error = await insertRes.json()
      throw new Error(error.message || 'Failed to insert seasonal price')
    }
    
    const inserted = await insertRes.json()

    try {
      await revalidateListingPaths('update', listingId)
    } catch (e) {
      console.warn('[SEASONAL-PRICES] revalidate:', e?.message)
    }
    
    return NextResponse.json({
      status: 'success',
      data: inserted[0] || inserted,
      meta: {
        partnerId: userId,
        conflictsResolved: {
          deleted: toDelete.length,
          updated: toUpdate.length
        }
      }
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
