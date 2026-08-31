import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { supabaseAdmin } from '@/lib/supabase'
import {
  assignRegion,
  clearRegion,
} from '@/lib/services/admin/local-leader-region.service.js'
import {
  interceptDuplicateIdempotencyKey,
  readIdempotencyKeyFromRequest,
} from '@/lib/services/audit/admin-audit'
import { getCorrelationId } from '@/lib/request-correlation.js'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const access = await requireAdminStaff(request)
  if (access.error) return access.error
  if (!supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'DB_UNAVAILABLE' }, { status: 503 })
  }

  const idempotencyKey = readIdempotencyKeyFromRequest(request)
  if (idempotencyKey) {
    const duplicate = await interceptDuplicateIdempotencyKey(idempotencyKey)
    if (duplicate) return duplicate
  }

  try {
    const body = await request.json().catch(() => ({}))
    const userId = String(body?.userId || '').trim()
    const regionIdRaw = body?.regionId
    const regionId = regionIdRaw == null ? null : String(regionIdRaw).trim()

    if (!userId) {
      return NextResponse.json({ success: false, error: 'USER_ID_REQUIRED' }, { status: 400 })
    }

    const context = {
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
      source: 'admin_user_detail',
    }

    const common = {
      userId,
      adminId: access.profile?.id,
      adminRole: access.profile?.role,
      requestId: getCorrelationId(),
      context,
      idempotencyKey,
    }

    if (!regionId) {
      const data = await clearRegion(supabaseAdmin, common)
      return NextResponse.json({ success: true, data })
    }

    const data = await assignRegion(supabaseAdmin, { ...common, regionId })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    const msg = String(error?.message || 'LOCAL_LEADER_ASSIGNMENT_FAILED')
    if (msg === 'USER_ID_REQUIRED' || msg === 'INVALID_REGION_ID') {
      return NextResponse.json({ success: false, error: msg }, { status: 400 })
    }
    if (msg === 'PROFILE_NOT_FOUND') {
      return NextResponse.json({ success: false, error: msg }, { status: 404 })
    }
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

