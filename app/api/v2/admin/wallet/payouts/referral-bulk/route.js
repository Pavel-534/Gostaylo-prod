/**
 * POST /api/v2/admin/wallet/payouts/referral-bulk
 * Stage 114.3 — массовый approve/reject очереди withdrawable_referral.
 * Body: { action: 'approve' | 'reject', userIds: string[] }
 */
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const access = await requireAdminStaff(request)
  if (access.error) return access.error

  let body = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = String(body?.action || '').trim().toLowerCase()
  const userIds = Array.isArray(body?.userIds)
    ? body.userIds.map((id) => String(id || '').trim()).filter(Boolean)
    : []
  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ success: false, error: 'INVALID_ACTION' }, { status: 400 })
  }
  if (!userIds.length) {
    return NextResponse.json({ success: false, error: 'USER_IDS_REQUIRED' }, { status: 400 })
  }

  const nowIso = new Date().toISOString()
  const patch =
    action === 'approve'
      ? {
          referral_withdrawal_status: 'paid',
          referral_withdrawal_requested_at: null,
          referral_withdrawal_amount_thb: null,
          updated_at: nowIso,
        }
      : {
          referral_withdrawal_status: null,
          referral_withdrawal_requested_at: null,
          referral_withdrawal_amount_thb: null,
          updated_at: nowIso,
        }

  const { data, error } = await supabaseAdmin
    .from('user_wallets')
    .update(patch)
    .in('user_id', userIds)
    .eq('referral_withdrawal_status', 'withdrawable_referral')
    .select('user_id,referral_withdrawal_status')

  if (error) {
    if (/referral_withdrawal_/i.test(String(error.message || ''))) {
      return NextResponse.json(
        { success: false, error: 'REFERRAL_WITHDRAWAL_COLUMNS_MISSING' },
        { status: 503 },
      )
    }
    return NextResponse.json(
      { success: false, error: error.message || 'REFERRAL_BULK_UPDATE_FAILED' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    success: true,
    data: {
      action,
      processed: (data || []).length,
      userIds: (data || []).map((r) => r.user_id),
    },
  })
}
