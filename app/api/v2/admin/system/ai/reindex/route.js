/**
 * POST /api/v2/admin/system/ai/reindex
 * Первичная (или точечная) переиндексация: до 5 объявлений за вызов. Только ADMIN.
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { supabaseAdmin } from '@/lib/supabase'
import { updateListingEmbedding, LISTING_STATUSES_ELIGIBLE_FOR_EMBEDDING } from '@/lib/ai/embeddings'
import { getJwtSecret } from '@/lib/auth/jwt-secret'

export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 5

function verifyAdminOnly() {
  let secret
  try {
    secret = getJwtSecret()
  } catch (e) {
    return { error: NextResponse.json({ success: false, error: e.message }, { status: 500 }) }
  }

  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('gostaylo_session')
  if (!sessionCookie?.value) {
    return { error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) }
  }
  try {
    const decoded = jwt.verify(sessionCookie.value, secret)
    if (decoded.role !== 'ADMIN') {
      return {
        error: NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 }),
      }
    }
    return { ok: true }
  } catch {
    return { error: NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 }) }
  }
}

export async function POST(request) {
  const auth = verifyAdminOnly()
  if (auth.error) return auth.error

  if (!supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 })
  }

  let limit = DEFAULT_LIMIT
  try {
    const body = await request.json().catch(() => ({}))
    const n = parseInt(body?.limit, 10)
    if (Number.isFinite(n) && n >= 1 && n <= 20) limit = n
  } catch {
    /* default */
  }

  const eligible = [...LISTING_STATUSES_ELIGIBLE_FOR_EMBEDDING]

  const { data: rows, error } = await supabaseAdmin
    .from('listings')
    .select('id')
    .in('status', eligible)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const ids = (rows || []).map((r) => r.id).filter(Boolean)
  const results = []

  for (const id of ids) {
    const r = await updateListingEmbedding(id)
    results.push({ id, ok: r.ok, error: r.error || null })
  }

  const okCount = results.filter((r) => r.ok).length

  return NextResponse.json({
    success: true,
    data: {
      limit,
      processed: results.length,
      succeeded: okCount,
      failed: results.length - okCount,
      results,
    },
  })
}
