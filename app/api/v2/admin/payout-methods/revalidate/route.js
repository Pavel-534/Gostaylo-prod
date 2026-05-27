import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function requireAdmin() {
  const access = await requireAdminStaff(request)
  if (access.error) return { error: access.error }
  return { ok: true }
}

export async function POST(request) {
  const auth = await requireAdmin()
  if (auth.error) {
    return auth.error
  }

  revalidatePath('/api/v2/payout-methods')
  revalidatePath('/api/v2/admin/payout-methods')

  return NextResponse.json({
    success: true,
    message: 'Payout methods cache invalidated',
    revalidatedAt: new Date().toISOString(),
  })
}
