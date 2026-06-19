import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import { supabaseAdmin } from '@/lib/supabase'
import { AuthErrorCode } from '@/lib/auth/auth-error-codes'

/**
 * @returns {Promise<
 *   | { error: NextResponse }
 *   | { userId: string, profile: object }
 * >}
 */
export async function requireSessionUser() {
  const session = await getSessionPayload()
  if (!session?.userId) {
    return {
      error: NextResponse.json(
        { success: false, error_code: AuthErrorCode.AUTH_NOT_AUTHENTICATED },
        { status: 401 },
      ),
    }
  }

  if (!supabaseAdmin) {
    return {
      error: NextResponse.json(
        { success: false, error_code: AuthErrorCode.AUTH_DATABASE_NOT_CONFIGURED },
        { status: 500 },
      ),
    }
  }

  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, role, is_banned, data_erasure_completed_at')
    .eq('id', session.userId)
    .maybeSingle()

  if (error || !profile) {
    return {
      error: NextResponse.json(
        { success: false, error_code: AuthErrorCode.AUTH_PROFILE_NOT_FOUND },
        { status: 401 },
      ),
    }
  }

  if (profile.is_banned === true || profile.data_erasure_completed_at) {
    return {
      error: NextResponse.json(
        { success: false, error_code: AuthErrorCode.AUTH_ACCOUNT_SUSPENDED },
        { status: 403 },
      ),
    }
  }

  return { userId: String(session.userId), profile }
}
