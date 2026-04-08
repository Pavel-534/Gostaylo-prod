/**
 * Ежедневная гигиена FCM: тихий badge-push по каждому токену; UNREGISTERED → удаление в PushService.
 * Триггер: GitHub Actions cron или Vercel Cron с Authorization: Bearer CRON_SECRET.
 */

import { NextResponse } from 'next/server'
import { PushService } from '@/lib/services/push.service'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const CRON_SECRET = process.env.CRON_SECRET
const BATCH = 25
const MAX_TOKENS = 800

function authorize(request) {
  if (!CRON_SECRET) return false
  const authHeader = request.headers.get('authorization')
  const cronSecret = request.headers.get('x-cron-secret')
  return authHeader === `Bearer ${CRON_SECRET}` || cronSecret === CRON_SECRET
}

async function runHygiene() {
  if (!supabaseAdmin) {
    return { ok: false, error: 'supabaseAdmin unavailable', probed: 0, removedHint: 0 }
  }
  const { data: rows, error } = await supabaseAdmin
    .from('user_push_tokens')
    .select('token')
    .limit(MAX_TOKENS)

  if (error) {
    return { ok: false, error: error.message, probed: 0, removedHint: 0 }
  }

  const tokens = (Array.isArray(rows) ? rows : [])
    .map((r) => String(r?.token || '').trim())
    .filter(Boolean)

  let probed = 0
  for (let i = 0; i < tokens.length; i += BATCH) {
    const chunk = tokens.slice(i, i + BATCH)
    await Promise.all(
      chunk.map(async (token) => {
        probed += 1
        await PushService.sendSilentBadgeUpdate(token, 0)
      }),
    )
  }

  return { ok: true, probed, maxTokens: MAX_TOKENS }
}

export async function POST(request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await runHygiene()
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'hygiene failed' }, { status: 500 })
  }
}

export async function GET(request) {
  return POST(request)
}
