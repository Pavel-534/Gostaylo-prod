/**
 * GoStayLo - Push Notifications API
 * POST /api/v2/push register/send/test
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { PushService } from '@/lib/services/push.service'
import { getSessionPayload } from '@/lib/services/session-service'
import { supabaseAdmin } from '@/lib/supabase'

async function requireSession() {
  const session = await getSessionPayload()
  return session?.userId ? session : null
}

async function isAdmin(userId) {
  if (!supabaseAdmin || !userId) return false
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  return String(data?.role || '').toUpperCase() === 'ADMIN'
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { action, token, templateKey, data, targetUserId } = body || {}

    // Action: register - токен только для пользователя из cookie-сессии
    if (action === 'register') {
      const session = await requireSession()
      if (!session) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }
      if (!token) {
        return NextResponse.json({ success: false, error: 'token required' }, { status: 400 })
      }
      const result = await PushService.registerToken(session.userId, token)
      return NextResponse.json(result)
    }

    // Action: send - only admin
    if (action === 'send') {
      const session = await requireSession()
      if (!session) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }
      if (!(await isAdmin(session.userId))) {
        return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
      }
      if (!targetUserId || !templateKey) {
        return NextResponse.json(
          { success: false, error: 'targetUserId and templateKey required' },
          { status: 400 },
        )
      }
      const result = await PushService.sendToUser(targetUserId, templateKey, data || {})
      return NextResponse.json(result)
    }

    // Action: test - send test to explicit token
    if (action === 'test') {
      if (!token) {
        return NextResponse.json({ success: false, error: 'token required' }, { status: 400 })
      }
      const result = await PushService.sendPush(token, 'NEW_MESSAGE', {
        sender: 'GoStayLo Test',
        link: '/',
      })
      return NextResponse.json(result)
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use: register, send, or test' },
      { status: 400 },
    )
  } catch (error) {
    console.error('[PUSH API ERROR]', error)
    return NextResponse.json({ success: false, error: error?.message || 'Push API error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    service: 'Firebase Cloud Messaging',
    project: process.env.FIREBASE_PROJECT_ID || 'gostaylo-push',
    templates: [
      'NEW_MESSAGE',
      'BOOKING_REQUEST',
      'BOOKING_CONFIRMED',
      'PAYMENT_RECEIVED',
      'CHECKIN_REMINDER',
      'PAYOUT_READY',
    ],
    endpoints: {
      register: 'POST /api/v2/push { action: "register", token: "..." }',
      send: 'POST /api/v2/push { action: "send", targetUserId: "...", templateKey: "...", data: {...} }',
      test: 'POST /api/v2/push { action: "test", token: "..." }',
    },
  })
}
