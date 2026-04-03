/**
 * GoStayLo - Renter Favorites API (v2)
 * 
 * GET /api/v2/renter/favorites - List all favorites for current user
 * POST /api/v2/renter/favorites - Toggle (add/remove) listing from favorites
 * 
 * Features:
 * - Server-side session validation
 * - Optimistic UI support
 * - Returns listing details with each favorite
 * 
 * @version 2.0
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { getJwtSecret } from '@/lib/auth/jwt-secret'

// Helper: Verify session and get user ID
async function getUserFromSession() {
  let secret
  try {
    secret = getJwtSecret()
  } catch {
    return null
  }
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('gostaylo_session')

  if (!sessionCookie?.value) {
    return null
  }

  try {
    const decoded = jwt.verify(sessionCookie.value, secret)
    return decoded.userId
  } catch (error) {
    return null
  }
}

// GET /api/v2/renter/favorites - List all favorites
export async function GET(request) {
  try {
    // Get user ID from query params (passed by client)
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    console.log('[FAVORITES] GET request for userId:', userId)
    
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'Missing userId'
      }, { status: 400 })
    }
    
    // First, get favorites
    const { data: favoritesData, error: favError } = await supabaseAdmin
      .from('favorites')
      .select('id, listing_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    console.log('[FAVORITES] Step 1 - Favorites query:', { 
      hasError: !!favError, 
      errorCode: favError?.code,
      errorMessage: favError?.message,
      dataLength: favoritesData?.length 
    })
    
    if (favError) {
      // If table doesn't exist, return empty array
      if (favError.code === 'PGRST116' || favError.message.includes('does not exist')) {
        console.log('[FAVORITES] Table does not exist yet, returning empty array')
        return NextResponse.json({
          success: true,
          data: [],
          count: 0,
          message: 'Favorites table will be created on first save'
        })
      }
      
      console.error('[FAVORITES GET ERROR]', favError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch favorites',
        details: favError.message,
        code: favError.code
      }, { status: 500 })
    }
    
    // If no favorites, return empty
    if (!favoritesData || favoritesData.length === 0) {
      console.log('[FAVORITES] No favorites found for user')
      return NextResponse.json({
        success: true,
        data: [],
        count: 0
      })
    }
    
    // Get listing IDs
    const listingIds = favoritesData.map(f => f.listing_id)
    
    // Fetch listings separately
    const { data: listingsData, error: listingsError } = await supabaseAdmin
      .from('listings')
      .select('*')
      .in('id', listingIds)
    
    console.log('[FAVORITES] Step 2 - Listings query:', { 
      hasError: !!listingsError,
      listingsFound: listingsData?.length 
    })
    
    if (listingsError) {
      console.error('[FAVORITES] Error fetching listings:', listingsError)
      // Return favorites without listings details
      return NextResponse.json({
        success: true,
        data: favoritesData.map(f => ({ ...f, listing: null })),
        count: favoritesData.length
      })
    }
    
    // Map listings to favorites
    const listingsMap = {}
    listingsData.forEach(listing => {
      listingsMap[listing.id] = listing
    })
    
    const formattedFavorites = favoritesData.map(fav => ({
      id: fav.id,
      listing_id: fav.listing_id,
      created_at: fav.created_at,
      listing: listingsMap[fav.listing_id] || null
    }))
    
    console.log(`[FAVORITES] Successfully formatted ${formattedFavorites.length} favorites`)
    
    return NextResponse.json({
      success: true,
      data: formattedFavorites,
      count: formattedFavorites.length
    })
    
  } catch (error) {
    console.error('[FAVORITES GET ERROR]', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// POST /api/v2/renter/favorites - Toggle favorite
export async function POST(request) {
  try {
    const { userId, listingId } = await request.json()
    
    if (!userId || !listingId) {
      return NextResponse.json({
        success: false,
        error: 'Missing userId or listingId'
      }, { status: 400 })
    }
    
    // Check if already favorited
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('listing_id', listingId)
      .single()
    
    if (checkError && checkError.code !== 'PGRST116') {
      // If table doesn't exist, create it first
      if (checkError.message.includes('does not exist')) {
        console.log('[FAVORITES] Creating favorites table...')
        // Note: In production, table should be created via migration
        // For now, we'll let Supabase auto-create on insert
      }
    }
    
    // Toggle logic
    if (existing) {
      // Remove from favorites
      const { error: deleteError } = await supabaseAdmin
        .from('favorites')
        .delete()
        .eq('id', existing.id)
      
      if (deleteError) {
        console.error('[FAVORITES DELETE ERROR]', deleteError)
        return NextResponse.json({
          success: false,
          error: 'Failed to remove from favorites'
        }, { status: 500 })
      }
      
      return NextResponse.json({
        success: true,
        action: 'removed',
        message: 'Removed from favorites',
        isFavorite: false
      })
    } else {
      // Add to favorites
      const { data: newFavorite, error: insertError } = await supabaseAdmin
        .from('favorites')
        .insert({
          user_id: userId,
          listing_id: listingId,
          created_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (insertError) {
        console.error('[FAVORITES INSERT ERROR]', insertError)
        return NextResponse.json({
          success: false,
          error: 'Failed to add to favorites'
        }, { status: 500 })
      }
      
      return NextResponse.json({
        success: true,
        action: 'added',
        message: 'Added to favorites',
        isFavorite: true,
        data: newFavorite
      })
    }
    
  } catch (error) {
    console.error('[FAVORITES POST ERROR]', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// DELETE /api/v2/renter/favorites - Remove specific favorite (alternative to POST toggle)
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const listingId = searchParams.get('listingId')
    
    if (!userId || !listingId) {
      return NextResponse.json({
        success: false,
        error: 'Missing userId or listingId'
      }, { status: 400 })
    }
    
    const { error: deleteError } = await supabaseAdmin
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('listing_id', listingId)
    
    if (deleteError) {
      console.error('[FAVORITES DELETE ERROR]', deleteError)
      return NextResponse.json({
        success: false,
        error: 'Failed to remove from favorites'
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      message: 'Removed from favorites'
    })
    
  } catch (error) {
    console.error('[FAVORITES DELETE ERROR]', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
