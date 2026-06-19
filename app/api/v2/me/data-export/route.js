/**
 * GET /api/v2/me/data-export — portable JSON export (DSAR).
 */

import { NextResponse } from 'next/server'
import { rateLimitCheck } from '@/lib/rate-limit'
import { requireSessionUser } from '@/lib/privacy/require-session-user'
import { buildUserDataExport } from '@/lib/privacy/data-subject-export.service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request) {
  const auth = await requireSessionUser()
  if (auth.error) return auth.error

  const rl = await rateLimitCheck(request, 'data_export', auth.userId)
  if (rl) {
    return NextResponse.json(rl.body, { status: rl.status, headers: rl.headers })
  }

  try {
    const result = await buildUserDataExport(auth.userId)
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 404 })
    }

    const filename = `data-export-${auth.userId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`

    return NextResponse.json(
      { success: true, data: result.export },
      {
        headers: {
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      },
    )
  } catch (e) {
    console.error('[me/data-export]', e)
    return NextResponse.json({ success: false, error: 'Export failed' }, { status: 500 })
  }
}
