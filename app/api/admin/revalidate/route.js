/**
 * Cache Revalidation API (Airbnb-style Smart Caching)
 * POST - Trigger on-demand revalidation for specific paths
 * 
 * Usage: Manually triggered by admin OR automatically via webhooks
 * when listings are created/updated/deleted
 */

import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const body = await request.json()
    const { paths = [], secret } = body

    // Optional: Add secret token for webhook security
    // const REVALIDATION_SECRET = process.env.REVALIDATION_SECRET
    // if (secret !== REVALIDATION_SECRET) {
    //   return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
    // }

    // Default paths to revalidate
    const defaultPaths = [
      '/',                    // Homepage
      '/listings',            // Listings page
      '/renter',             // Renter dashboard
      '/partner/dashboard',  // Partner dashboard
    ]

    const pathsToRevalidate = paths.length > 0 ? paths : defaultPaths

    console.log('[REVALIDATION] Triggering revalidation for:', pathsToRevalidate)

    // Revalidate each path
    for (const path of pathsToRevalidate) {
      try {
        revalidatePath(path)
        console.log(`[REVALIDATION] ✅ Revalidated: ${path}`)
      } catch (error) {
        console.error(`[REVALIDATION] ❌ Failed to revalidate ${path}:`, error)
      }
    }

    // Also revalidate listing routes with layout revalidation
    try {
      revalidatePath('/listings', 'layout')
      console.log('[REVALIDATION] ✅ Revalidated listings layout')
    } catch (error) {
      console.error('[REVALIDATION] ❌ Failed to revalidate listings layout:', error)
    }

    return NextResponse.json({
      success: true,
      message: 'Cache revalidation triggered',
      paths: pathsToRevalidate,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[REVALIDATION] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
