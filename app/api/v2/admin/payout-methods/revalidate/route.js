import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAccess } from '@/lib/security/access-guard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function requireAdmin() {
  const access = await requireAccess({ roles: ['ADMIN'] })
  if (access.error) return { error: access.error }
  return { ok: true }
}

export async function POST() {
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
