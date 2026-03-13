/**
 * Session Service - Server-side session validation
 * 
 * Uses REST API for Supabase access
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/**
 * Extract user ID from request
 */
export function getUserIdFromRequest(request) {
  try {
    // 1. Try Authorization header
    const authHeader = request.headers.get('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      try {
        const decoded = JSON.parse(atob(token))
        if (decoded.userId) return decoded.userId
      } catch {}
    }
    
    // 2. Try custom header
    const userIdHeader = request.headers.get('X-User-Id')
    if (userIdHeader) return userIdHeader
    
    // 3. Try query params
    const { searchParams } = new URL(request.url)
    const partnerId = searchParams.get('partnerId')
    if (partnerId) return partnerId
    
    return null
  } catch (error) {
    console.error('[SESSION] Error:', error.message)
    return null
  }
}

/**
 * Verify user has partner access
 */
export async function verifyPartnerAccess(userId) {
  if (!userId) return null
  
  // If no Supabase config, allow access (dev mode)
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log('[SESSION] No Supabase, allowing access')
    return { id: userId, role: 'PARTNER' }
  }
  
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=id,email,first_name,role`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    )
    
    const profiles = await res.json()
    
    if (!Array.isArray(profiles) || profiles.length === 0) {
      console.log('[SESSION] User not found:', userId)
      return null
    }
    
    const profile = profiles[0]
    
    // Check role
    const hasAccess = ['PARTNER', 'ADMIN', 'MODERATOR'].includes(profile.role)
    if (!hasAccess) {
      console.log('[SESSION] Access denied for role:', profile.role)
      return null
    }
    
    console.log(`[SESSION] Access granted: ${profile.email} (${profile.role})`)
    return profile
    
  } catch (error) {
    console.error('[SESSION] Error:', error.message)
    // Allow access on error (graceful degradation)
    return { id: userId, role: 'PARTNER' }
  }
}

export default {
  getUserIdFromRequest,
  verifyPartnerAccess
}
