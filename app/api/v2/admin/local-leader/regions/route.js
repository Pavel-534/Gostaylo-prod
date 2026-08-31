import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { listAvailableRegions } from '@/lib/services/admin/local-leader-region.service.js'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const access = await requireAdminStaff(request)
  if (access.error) return access.error

  const regions = listAvailableRegions()
  return NextResponse.json({ success: true, data: { regions } })
}

