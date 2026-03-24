/**
 * Session Service - Server-side session validation
 * 
 * Uses REST API for Supabase access
 * SECURITY: Prefer getUserIdFromSession() - it reads from JWT cookie and cannot be spoofed
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
// Use service role to bypass RLS when verifying partner access (server-side)
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const JWT_SECRET = process.env.JWT_SECRET || 'gostaylo-secret-key-change-in-production'

/**
 * Extract user ID from gostaylo_session cookie (JWT) - SECURE, cannot be spoofed by client
 * Use this for partner APIs that must verify ownership
 */
export async function getUserIdFromSession() {
  const payload = await getSessionPayload()
  return payload?.userId ?? null
}

/**
 * Полный payload JWT из cookie (userId, role, email) — для проверок RBAC на сервере.
 */
export async function getSessionPayload() {
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = cookies()
    const session = cookieStore.get('gostaylo_session')
    if (!session?.value) return null
    const jwt = (await import('jsonwebtoken')).default
    const decoded = jwt.verify(session.value, JWT_SECRET)
    const role = String(decoded?.role || '').toUpperCase()
    return {
      userId: decoded?.userId || null,
      role,
      email: decoded?.email || null,
    }
  } catch {
    return null
  }
}

/**
 * Extract user ID from request (legacy - prefers session, then headers/params)
 * SECURITY: For partner APIs, always verify partnerId/owner_id matches session userId
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
    
    // 3. Try query params (LEGACY - caller must verify matches session!)
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
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=id,email,first_name,last_name,role`,
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
    const effectiveRole = profile.last_name?.includes('[MODERATOR]') ? 'MODERATOR' : profile.role
    
    // Check role (DB is source of truth — JWT may still say RENTER after partner approval)
    const hasAccess = ['PARTNER', 'ADMIN', 'MODERATOR'].includes(effectiveRole)
    if (!hasAccess) {
      console.log('[SESSION] Access denied for role:', effectiveRole)
      return null
    }
    
    console.log(`[SESSION] Access granted: ${profile.email} (${effectiveRole})`)
    return { ...profile, role: effectiveRole }
    
  } catch (error) {
    console.error('[SESSION] Error:', error.message)
    // Allow access on error (graceful degradation)
    return { id: userId, role: 'PARTNER' }
  }
}

export default {
  getUserIdFromSession,
  getSessionPayload,
  getUserIdFromRequest,
  verifyPartnerAccess,
}
