import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request) {
  const session = await getSessionPayload()
  if (!session?.userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 500 })
  }

  let at = new Date().toISOString()
  try {
    const contentType = String(request.headers.get('content-type') || '').toLowerCase()
    if (contentType.includes('application/json')) {
      const body = await request.json().catch(() => ({}))
      const raw = String(body?.at || '').trim()
      if (raw) {
        const d = new Date(raw)
        if (!Number.isNaN(d.getTime())) at = d.toISOString()
      }
    } else {
      // sendBeacon commonly posts text/plain; we intentionally ignore body and use server time.
    }
  } catch {
    // Keep server timestamp fallback.
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ last_seen_at: at })
    .eq('id', session.userId)

  if (error) {
    return NextResponse.json({ success: false, error: error.message || 'Update failed' }, { status: 400 })
  }
  return NextResponse.json({ success: true, at })
}
