/**
 * GET /api/v2/profile?userId= — profile by id (session required).
 * Stage 154.1: self-only for authenticated users; staff (ADMIN/MODERATOR) may read any id.
 * Prefer GET /api/v2/auth/me or PATCH /api/v2/profile/me for the current user.
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireSession } from '@/lib/api/api-guard'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { AuthErrorCode } from '@/lib/auth/auth-error-codes'

function transformProfile(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.first_name,
    lastName: user.last_name,
    name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
    phone: user.phone,
    isVerified: user.is_verified,
    verificationStatus: user.verification_status,
    referralCode: user.referral_code,
    preferredCurrency: user.preferred_currency,
    customCommissionRate: user.custom_commission_rate,
    availableBalance: parseFloat(user.available_balance) || 0,
    escrowBalance: parseFloat(user.escrow_balance) || 0,
    telegramLinked: user.telegram_linked,
    notificationPreferences: user.notification_preferences,
    createdAt: user.created_at,
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = String(searchParams.get('userId') || '').trim()

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 })
    }

    const guard = await requireSession()
    if (!guard.ok) return guard.response

    const requesterId = String(guard.session.userId || '')
    if (userId !== requesterId) {
      const staff = await requireAdminStaff(request)
      if (staff.error) return staff.error
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, error_code: AuthErrorCode.AUTH_DATABASE_NOT_CONFIGURED },
        { status: 500 },
      )
    }

    const { data: user, error } = await supabaseAdmin.from('profiles').select('*').eq('id', userId).single()

    if (error || !user) {
      return NextResponse.json(
        { success: false, error_code: AuthErrorCode.AUTH_PROFILE_NOT_FOUND, error: 'User not found' },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true, data: transformProfile(user) })
  } catch (error) {
    console.error('[PROFILE GET ERROR]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
