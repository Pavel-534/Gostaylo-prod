import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import { supabaseAdmin } from '@/lib/supabase'
import { AuthErrorCode, authErrorJson } from '@/lib/auth/auth-error-codes'

export const dynamic = 'force-dynamic'

const THEMES = ['beach', 'city', 'sea']

/**
 * Stage 207 — GET /api/v2/referral/story-stats
 * Visits and sign-ups that came via the Stories invite card QR (`/s/{code}`).
 */
export async function GET() {
  const session = await getSessionPayload()
  if (!session?.userId) {
    return authErrorJson(AuthErrorCode.AUTH_NOT_AUTHENTICATED, 401)
  }

  const { data, error } = await supabaseAdmin
    .from('referral_attributions')
    .select('utm_source, status')
    .eq('referrer_id', session.userId)
    .eq('utm_campaign', 'story_card')
    .eq('touch_type', 'last')
    .limit(10000)

  if (error) {
    return NextResponse.json({ success: false, error_code: 'STORY_STATS_FAILED' }, { status: 500 })
  }

  const byTheme = Object.fromEntries(THEMES.map((th) => [th, { visits: 0, signups: 0 }]))
  let visits = 0
  let signups = 0
  for (const row of data || []) {
    const theme = String(row.utm_source || '').replace(/^story_/, '')
    const converted = row.status === 'converted'
    visits += 1
    if (converted) signups += 1
    if (byTheme[theme]) {
      byTheme[theme].visits += 1
      if (converted) byTheme[theme].signups += 1
    }
  }

  return NextResponse.json({ success: true, data: { visits, signups, byTheme } })
}
