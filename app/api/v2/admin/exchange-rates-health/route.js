/**
 * GET /api/v2/admin/exchange-rates-health
 * Снимок устаревания дисплей-курсов по БД (без вызова внешнего FX API). Только ADMIN.
 */

import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { getJwtSecret } from '@/lib/auth/jwt-secret'
import { getDisplayFxStaleHealthFromDb } from '@/lib/services/currency.service'

function verifyAdmin() {
  let secret
  try {
    secret = getJwtSecret()
  } catch (e) {
    return { error: e.message, status: 500 }
  }

  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('gostaylo_session')
  if (!sessionCookie?.value) {
    return { error: 'Unauthorized', status: 401 }
  }
  try {
    const decoded = jwt.verify(sessionCookie.value, secret)
    if (decoded.role !== 'ADMIN') {
      return { error: 'Admin access required', status: 403 }
    }
    return { ok: true }
  } catch {
    return { error: 'Invalid session', status: 401 }
  }
}

export async function GET() {
  const gate = verifyAdmin()
  if (!gate.ok) {
    return NextResponse.json(
      { success: false, error: gate.error },
      { status: gate.status ?? 403 },
    )
  }

  try {
    const health = await getDisplayFxStaleHealthFromDb()
    return NextResponse.json({
      success: true,
      data: {
        stale: health.stale,
        staleCodes: health.staleCodes,
        lastUpdateLabel: health.lastUpdateLabel,
        oldestStaleIso: health.oldestStaleIso,
      },
    })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e?.message || String(e) },
      { status: 500 },
    )
  }
}
