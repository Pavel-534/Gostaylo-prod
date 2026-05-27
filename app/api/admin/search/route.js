/**
 * GET /api/admin/search?q=... — глобальный поиск админки (Stage 118.4).
 */
import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { runAdminGlobalSearch } from '@/lib/admin/admin-global-search.server'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const gate = await requireAdminStaff(request)
  if (gate.error) return gate.error

  const q = new URL(request.url).searchParams.get('q') || ''
  const { results, mode, error } = await runAdminGlobalSearch(q)

  if (error) {
    return NextResponse.json({ success: false, error }, { status: 503 })
  }

  return NextResponse.json({
    success: true,
    data: { results, mode, query: String(q).trim() },
  })
}
