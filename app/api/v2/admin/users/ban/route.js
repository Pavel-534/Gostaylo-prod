/**
 * POST /api/v2/admin/users/ban — ban user (ADMIN session or signed Telegram link token).
 * GET  ?t=... — same as one-click from Telegram URL button.
 *
 * Sets profiles.is_banned and Supabase Auth ban_duration (invalidates refresh tokens).
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { supabaseAdmin } from '@/lib/supabase'
import { getJwtSecret } from '@/lib/auth/jwt-secret'
import { verifyTelegramBanLinkToken } from '@/lib/auth/telegram-ban-link'

export const dynamic = 'force-dynamic'

const BAN_DURATION = '876600h' // ~100 years

function verifyAdminSession() {
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
    return { adminId: decoded.userId }
  } catch {
    return { error: NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 }) }
  }
}

async function assertTargetBanOk(userId) {
  const { data: row, error } = await supabaseAdmin
    .from('profiles')
    .select('id, role')
    .eq('id', userId)
    .maybeSingle()
  if (error) return { error: error.message }
  if (!row) return { error: 'User not found' }
  const role = String(row.role || '').toUpperCase()
  if (role === 'ADMIN' || role === 'MODERATOR') {
    return { error: 'Cannot ban staff roles' }
  }
  return { ok: true }
}

async function performBan(userId) {
  const gate = await assertTargetBanOk(userId)
  if (gate.error) return { error: gate.error }

  const { error: pErr } = await supabaseAdmin.from('profiles').update({ is_banned: true }).eq('id', userId)
  if (pErr) return { error: pErr.message }

  const { error: aErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    ban_duration: BAN_DURATION,
  })
  if (aErr) {
    console.warn('[admin/users/ban] auth.admin.updateUserById:', aErr.message)
    // Profile already flagged; Auth may be out of sync if user only exists in profiles
  }
  return { ok: true }
}

export async function GET(request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'Server misconfigured' }, { status: 500 })
  }
  const { searchParams } = new URL(request.url)
  const t = searchParams.get('t')
  const parsed = verifyTelegramBanLinkToken(t)
  if (!parsed?.userId) {
    return new NextResponse('<p>Invalid or expired link.</p>', {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
  const result = await performBan(parsed.userId)
  if (result.error) {
    return new NextResponse(`<p>${escapeHtml(result.error)}</p>`, {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
  return new NextResponse('<p>User banned. Sessions invalidated.</p>', {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export async function POST(request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'Server misconfigured' }, { status: 500 })
  }

  let body = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const userId = body.userId != null ? String(body.userId).trim() : ''
  if (!userId) {
    return NextResponse.json({ success: false, error: 'userId required' }, { status: 400 })
  }

  const admin = verifyAdminSession()
  const linkToken = body.banToken != null ? String(body.banToken).trim() : ''
  const parsedLink = linkToken ? verifyTelegramBanLinkToken(linkToken) : null

  if (!admin.error) {
    const result = await performBan(userId)
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  }

  if (parsedLink && parsedLink.userId === userId) {
    const result = await performBan(userId)
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  }

  return admin.error
}
