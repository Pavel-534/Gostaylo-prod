import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import {
  getFintechSettingsForAdmin,
  updateFintechSettings,
} from '@/lib/services/finance/fintech-settings.service.js'
import { computeWaterfallPreview } from '@/lib/services/finance/fintech-waterfall.js'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const gate = await requireAdminStaff(request)
  if (gate.error) return gate.error

  try {
    const { row, policy, api } = await getFintechSettingsForAdmin()
    const preview = computeWaterfallPreview(policy)
    return NextResponse.json({
      success: true,
      data: {
        settings: api,
        version: policy.version,
        updated_at: row?.updated_at || policy.updatedAt,
        updated_by: row?.updated_by || null,
        preview,
      },
    })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: 'FINTECH_SETTINGS_READ_FAILED', message: e?.message || 'read failed' },
      { status: 500 },
    )
  }
}

export async function PUT(request) {
  const gate = await requireAdminStaff(request)
  if (gate.error) return gate.error

  const body = await request.json().catch(() => ({}))
  const staffId = gate.profile?.id || null

  try {
    const result = await updateFintechSettings(body, staffId)
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'VALIDATION_FAILED',
          message: result.message || 'Validation failed',
          details: result.details || null,
        },
        { status: 400 },
      )
    }

    const preview = computeWaterfallPreview(result.policy)
    return NextResponse.json({
      success: true,
      data: {
        settings: result.data,
        changes: result.changes,
        preview,
      },
    })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: 'FINTECH_SETTINGS_UPDATE_FAILED', message: e?.message || 'update failed' },
      { status: 500 },
    )
  }
}
