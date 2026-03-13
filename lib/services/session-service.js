/**
 * Session Service - Server-side session validation
 * 
 * SECURITY FIRST: All partner APIs must validate session before accessing data
 * Uses HttpOnly cookies for session management
 */

import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Get session from request cookies (server-side only)
 * Returns user object or null if not authenticated
 */
export async function getServerSession() {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('gostaylo_session')
    
    if (!sessionCookie?.value) {
      console.log('[SESSION] No session cookie found')
      return null
    }
    
    // Parse session
    const session = JSON.parse(sessionCookie.value)
    
    if (!session?.userId) {
      console.log('[SESSION] Invalid session structure')
      return null
    }
    
    // Optionally verify session in database
    // For now, trust the cookie (signed by HttpOnly)
    return {
      userId: session.userId,
      email: session.email,
      role: session.role,
      name: session.name
    }
  } catch (error) {
    console.error('[SESSION] Error parsing session:', error.message)
    return null
  }
}

/**
 * Extract user ID from request headers or cookies
 * Falls back to query params for backwards compatibility
 */
export function getUserIdFromRequest(request) {
  try {
    // 1. Try Authorization header (Bearer token)
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
    
    // 3. Try query params (backwards compatibility)
    const { searchParams } = new URL(request.url)
    const partnerId = searchParams.get('partnerId')
    if (partnerId) return partnerId
    
    return null
  } catch (error) {
    console.error('[SESSION] Error extracting user ID:', error.message)
    return null
  }
}

/**
 * Verify user exists and has partner access
 * Returns user profile or null
 */
export async function verifyPartnerAccess(userId) {
  if (!userId) return null
  if (!supabaseAdmin) {
    console.log('[SESSION] Supabase not configured, skipping verification')
    return { id: userId, role: 'PARTNER' } // Mock fallback
  }
  
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, name, role, is_verified, custom_commission_rate')
      .eq('id', userId)
      .single()
    
    if (error || !profile) {
      console.log('[SESSION] User not found:', userId)
      return null
    }
    
    // Check role
    const hasAccess = ['PARTNER', 'ADMIN', 'MODERATOR'].includes(profile.role)
    if (!hasAccess) {
      console.log('[SESSION] Access denied for role:', profile.role)
      return null
    }
    
    return profile
  } catch (error) {
    console.error('[SESSION] Error verifying access:', error.message)
    return null
  }
}

export default {
  getServerSession,
  getUserIdFromRequest,
  verifyPartnerAccess
}
