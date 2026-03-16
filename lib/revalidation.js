/**
 * Revalidation Helper
 * Utility to trigger cache revalidation after listing mutations
 */

import { revalidatePath } from 'next/cache'

/**
 * Revalidate listing-related paths after create/update/delete
 * @param {string} action - 'create', 'update', or 'delete'
 * @param {string} listingId - Optional listing ID for specific revalidation
 */
export async function revalidateListingPaths(action, listingId = null) {
  try {
    console.log(`[REVALIDATION] Triggering for action: ${action}, listing: ${listingId || 'N/A'}`)

    // Core paths that always need revalidation
    const corePaths = [
      '/',                    // Homepage - shows featured/latest listings
      '/listings',            // Main listings page
      '/renter',             // Renter dashboard
    ]

    for (const path of corePaths) {
      revalidatePath(path)
      console.log(`[REVALIDATION] ✅ ${path}`)
    }

    // Revalidate specific listing page if ID provided
    if (listingId) {
      revalidatePath(`/listings/${listingId}`)
      console.log(`[REVALIDATION] ✅ /listings/${listingId}`)
    }

    // Revalidate listings layout (includes all nested routes)
    revalidatePath('/listings', 'layout')
    console.log(`[REVALIDATION] ✅ /listings (layout)`)

    return { success: true }
  } catch (error) {
    console.error('[REVALIDATION] Error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Revalidate partner-related paths
 * @param {string} partnerId - Partner UUID
 */
export async function revalidatePartnerPaths(partnerId) {
  try {
    revalidatePath('/partner/dashboard')
    revalidatePath('/partner/listings')
    console.log(`[REVALIDATION] ✅ Partner paths for ${partnerId}`)
    return { success: true }
  } catch (error) {
    console.error('[REVALIDATION] Error:', error)
    return { success: false, error: error.message }
  }
}
